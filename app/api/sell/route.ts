// app/api/sell/route.ts (MARKET SELL)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // --- Auth ---
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // --- Body ---
    const body = await req.json();
    const { marketSlug, marketId, side, quantity } = body || {};
    const slugOrId = marketSlug || marketId;

    if (!slugOrId || !side || !quantity) {
      return NextResponse.json(
        { error: 'marketSlug (or marketId), side, and quantity are required' },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 });
    }

    // --- Market ---
    let market = await prisma.marketCache.findUnique({ where: { slug: slugOrId } });
    if (!market) {
      market = await prisma.marketCache.findUnique({ where: { id: slugOrId } });
    }
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // --- Price & holdings ---
    const prices = JSON.parse(market.outcomePricesJson || '["0.5","0.5"]');
    const price = side === 'YES' ? parseFloat(prices[0]) : parseFloat(prices[1]);
    if (isNaN(price)) {
      return NextResponse.json({ error: 'Invalid market prices' }, { status: 500 });
    }

    // We will do the validation and writes inside a transaction to avoid races
    const result = await prisma.$transaction(async (tx) => {
      // re-read user & position inside tx
      const user = await tx.user.findUnique({ where: { id: decoded.userId } });
      if (!user) throw new Error('USER_NOT_FOUND_TX');

      const existingPosition = await tx.position.findFirst({
        where: { userId: user.id, marketId: market.id, side },
      });
      if (!existingPosition) {
        throw new Error('NO_POSITION');
      }

      // Compute available shares (quantity - reservedQuantity)
      const reserved = existingPosition.reservedQuantity || 0;
      const available = (existingPosition.quantity || 0) - reserved;

      if (available < qty) {
        throw new Error(`INSUFFICIENT_SHARES: available ${available}, required ${qty}`);
      }

      const proceeds = qty * price;

      // 1) Create order
      const order = await tx.order.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side,
          orderType: 'MARKET',
          quantity: qty,
          filledQty: qty,
          fillPrice: price,
          status: 'FILLED',
        },
      });

      // 2) Create trade
      const trade = await tx.trade.create({
        data: {
          orderId: order.id,
          userId: user.id,
          marketId: market.id,
          side,
          quantity: qty,
          price,
        },
      });

      // 3) Reduce user's shares (quantity) — reservedQuantity unaffected (we did not reserve these shares)
      const updatedPosition = await tx.position.update({
        where: { id: existingPosition.id },
        data: {
          quantity: (existingPosition.quantity || 0) - qty,
        },
      });

      // 4) Credit proceeds to user's demoBalance
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { demoBalance: { increment: proceeds } as any },
      });

      return { order, trade, updatedPosition, updatedUser, proceeds };
    });

    return NextResponse.json({
      success: true,
      proceeds: result.proceeds,
      newBalance: result.updatedUser.demoBalance,
      order: result.order,
      trade: result.trade,
      position: result.updatedPosition,
    });
  } catch (error: any) {
    console.error('Sell error:', error);
    const msg = (error?.message || '').toString();
    if (msg === 'NO_POSITION' || msg.startsWith('INSUFFICIENT_SHARES')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to sell' }, { status: 500 });
  }
}
