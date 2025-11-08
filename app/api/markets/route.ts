import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Market = {
  id: string;
  slug: string;
  eventSlug: string | null;
  question: string;
  description: string | null;
  imageUrl: string | null;
  outcomePricesJson: string;
  outcomeLabelsJson: string;
  endDate: Date | null;
  active: boolean;
  closed: boolean;
  volume: number | null;
  volume24h: number | null;
  volume7d: number | null;
  volume30d: number | null;
  category: string | null;
  lastSynced: Date;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const active = searchParams.get('active') === 'true';
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'volume'; // volume, volume24h, volume7d, volume30d
    const category = searchParams.get('category');

    // Build where clause
    const where: any = active ? { active: true, closed: false } : {};
    
    if (search) {
      where.question = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.category = category;
    }

    // Build orderBy clause
    const orderByMap: { [key: string]: string } = {
      volume: 'volume',
      volume24h: 'volume24h',
      volume7d: 'volume7d',
      volume30d: 'volume30d',
    };

    const orderByField = orderByMap[sortBy] || 'volume';

    const markets = await prisma.marketCache.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [orderByField]: 'desc' },
    });

    // Parse prices and outcome labels
    const marketsWithParsedData = markets.map((market: Market) => ({
      ...market,
      outcomePrices: JSON.parse(market.outcomePricesJson),
      outcomeLabels: JSON.parse(market.outcomeLabelsJson),
    }));

    return NextResponse.json({
      success: true,
      markets: marketsWithParsedData,
      count: marketsWithParsedData.length,
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
