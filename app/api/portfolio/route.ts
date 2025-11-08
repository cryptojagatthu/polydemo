import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Define types
type Position = {
  id: number;
  userId: number;
  marketId: string;
  side: string;
  avgPrice: number;
  quantity: number;
  realizedPnl: number;
  updatedAt: Date;
  market: {
    id: string;
    slug: string;
    eventSlug: string | null;
    question: string;
    outcomePricesJson: string;
    active: boolean;
    closed: boolean;
    volume: number | null;
    lastSynced: Date;
  };
};

type PositionWithPnl = {
  id: number;
  marketQuestion: string;
  marketSlug: string;
  side: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  totalValue: number;
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    const positions = await prisma.position.findMany({
      where: { userId: decoded.userId, quantity: { gt: 0 } },
      include: { market: true },
    });

    // Calculate unrealized PnL for each position with proper typing
    const positionsWithPnl: PositionWithPnl[] = positions.map((pos: Position) => {
      const prices = JSON.parse(pos.market.outcomePricesJson);
      const currentPrice = pos.side === 'YES' ? parseFloat(prices[0]) : parseFloat(prices[1]);
      const unrealizedPnl = (currentPrice - pos.avgPrice) * pos.quantity;
      
      return {
        id: pos.id,
        marketQuestion: pos.market.question,
        marketSlug: pos.market.slug,
        side: pos.side,
        quantity: pos.quantity,
        avgPrice: pos.avgPrice,
        currentPrice,
        unrealizedPnl,
        totalValue: currentPrice * pos.quantity,
      };
    });

    const totalUnrealizedPnl = positionsWithPnl.reduce(
      (sum: number, pos: PositionWithPnl) => sum + pos.unrealizedPnl,
      0
    );

    return NextResponse.json({
      success: true,
      balance: user?.demoBalance || 0,
      positions: positionsWithPnl,
      totalUnrealizedPnl,
      totalEquity: (user?.demoBalance || 0) + totalUnrealizedPnl,
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
