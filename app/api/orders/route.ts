import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { marketSlug, side, quantity } = await req.json();

    if (!marketSlug || !side || !quantity) {
      return NextResponse.json(
        { error: 'marketSlug, side, and quantity are required' },
        { status: 400 }
      );
    }

    if (side !== 'YES' && side !== 'NO') {
      return NextResponse.json(
        { error: 'side must be YES or NO' },
        { status: 400 }
      );
    }

    const qty = Math.floor(Number(quantity));
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'quantity must be a valid positive number' },
        { status: 400 }
      );
    }

    const market = await prisma.marketCache.findUnique({
      where: { slug: marketSlug },
    });

    if (!market || !market.active) {
      return NextResponse.json(
        { error: 'Market not available' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // --- Load price ---
    const prices = JSON.parse(market.outcomePricesJson || '["0.5","0.5"]');

    let price = side === 'YES'
      ? Number(prices[0])
      : Number(prices[1]);

    // ✅ Normalize cents → decimal
    if (price > 1) price = price / 100;

    if (isNaN(price)) {
      return NextResponse.json(
        { error: 'Invalid market prices' },
        { status: 500 }
      );
    }

    const cost = qty * price;

    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!u) throw new Error('USER_NOT_FOUND_TX');

      if ((u.demoBalance || 0) < cost) {
        throw new Error(
          `INSUFFICIENT_BALANCE: need ${cost.toFixed(2)}, have ${(u.demoBalance || 0).toFixed(2)}`
        );
      }

      // 1. Create order
      const order = await tx.order.create({
        data: {
          userId: u.id,
          marketId: market.id,
          side,
          sideType: "BUY",           // ✅ consistency
          orderType: "MARKET",
          quantity: qty,
          filledQty: qty,
          fillPrice: price,
          status: "FILLED",
        },
      });

      // 2. Create trade
      const trade = await tx.trade.create({
        data: {
          orderId: order.id,
          userId: u.id,
          marketId: market.id,
          side,
          quantity: qty,
          price,
        },
      });

      // 3. Update or create position
      const existingPosition = await tx.position.findFirst({
        where: {
          userId: u.id,
          marketId: market.id,
          side,
        },
      });

      if (existingPosition) {
        const newQty = existingPosition.quantity + qty;
        const newAvg =
          (existingPosition.avgPrice * existingPosition.quantity + price * qty) / newQty;

        await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            quantity: newQty,
            avgPrice: newAvg,
          },
        });
      } else {
        await tx.position.create({
          data: {
            userId: u.id,
            marketId: market.id,
            side,
            quantity: qty,
            avgPrice: price,
          },
        });
      }

      // 4. Deduct user balance
      await tx.user.update({
        where: { id: u.id },
        data: {
          demoBalance: { decrement: cost } as any,
        },
      });

      return {
        order,
        trade,
        newBalance: u.demoBalance - cost,
      };
    });

    return NextResponse.json({
      success: true,
      order: result.order,
      trade: result.trade,
      cost,
      newBalance: result.newBalance,
    });

  } catch (error: any) {
    console.error('Order error:', error);

    const msg = (error?.message || '').toString();

    if (msg.startsWith('INSUFFICIENT_BALANCE')) {
      return NextResponse.json(
        { error: msg },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to place order' },
      { status: 500 }
    );
  }
}
