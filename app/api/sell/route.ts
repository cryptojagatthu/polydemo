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

    // --- User ---
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // --- Price & holdings ---
    const prices = JSON.parse(market.outcomePricesJson || '["0.5","0.5"]');
    const price = side === 'YES' ? parseFloat(prices[0]) : parseFloat(prices[1]);
    if (isNaN(price)) {
      return NextResponse.json({ error: 'Invalid market prices' }, { status: 500 });
    }

    const existingPosition = await prisma.position.findFirst({
      where: { userId: user.id, marketId: market.id, side },
    });

    if (!existingPosition || existingPosition.quantity < qty) {
      return NextResponse.json({ error: 'Not enough shares to sell' }, { status: 400 });
    }

    const proceeds = qty * price;

    // --- Transaction ---
    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ Create Order
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

      // 2️⃣ Create Trade linked to that order
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

      // 3️⃣ Update Position
      const updatedPosition = await tx.position.update({
        where: { id: existingPosition.id },
        data: {
          quantity: existingPosition.quantity - qty,
        },
      });

      // 4️⃣ Update Balance
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { demoBalance: user.demoBalance + proceeds },
      });

      return { order, trade, updatedPosition, updatedUser };
    });

    return NextResponse.json({
      success: true,
      proceeds,
      newBalance: result.updatedUser.demoBalance,
      order: result.order,
      trade: result.trade,
      position: result.updatedPosition,
    });
  } catch (error) {
    console.error('Sell error:', error);
    return NextResponse.json({ error: 'Failed to sell' }, { status: 500 });
  }
}
