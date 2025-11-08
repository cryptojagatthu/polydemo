import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
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

    // Parse request body
    const { marketSlug, side, quantity } = await req.json();

    // Validate input
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

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be greater than 0' },
        { status: 400 }
      );
    }

    // Get market
    const market = await prisma.marketCache.findUnique({
      where: { slug: marketSlug },
    });

    if (!market || !market.active) {
      return NextResponse.json(
        { error: 'Market not available' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate price and cost
    const prices = JSON.parse(market.outcomePricesJson);
    const price = side === 'YES' ? parseFloat(prices[0]) : parseFloat(prices[1]);
    const cost = quantity * price;

    // Check balance
    if (user.demoBalance < cost) {
      return NextResponse.json(
        { error: `Insufficient balance. Need $${cost.toFixed(2)}, have $${user.demoBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        marketId: market.id,
        side,
        orderType: 'MARKET',
        quantity,
        filledQty: quantity,
        fillPrice: price,
        status: 'FILLED',
      },
    });

    // Create trade
    const trade = await prisma.trade.create({
      data: {
        orderId: order.id,
        userId: user.id,
        marketId: market.id,
        side,
        quantity,
        price,
      },
    });

    // Update or create position
    const existingPosition = await prisma.position.findFirst({
      where: { userId: user.id, marketId: market.id, side },
    });

    if (existingPosition) {
      const newQty = existingPosition.quantity + quantity;
      const newAvg =
        (existingPosition.avgPrice * existingPosition.quantity + price * quantity) / newQty;

      await prisma.position.update({
        where: { id: existingPosition.id },
        data: { quantity: newQty, avgPrice: newAvg },
      });
    } else {
      await prisma.position.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side,
          avgPrice: price,
          quantity,
        },
      });
    }

    // Deduct balance
    await prisma.user.update({
      where: { id: user.id },
      data: { demoBalance: user.demoBalance - cost },
    });

    return NextResponse.json({
      success: true,
      order,
      trade,
      cost,
      newBalance: user.demoBalance - cost,
    });
  } catch (error) {
    console.error('Order error:', error);
    return NextResponse.json(
      { error: 'Failed to place order' },
      { status: 500 }
    );
  }
}
