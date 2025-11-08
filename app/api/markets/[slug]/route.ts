import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      );
    }

    const market = await prisma.marketCache.findUnique({
      where: { slug },
    });

    if (!market) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      market: {
        ...market,
        outcomePrices: JSON.parse(market.outcomePricesJson),
      },
    });
  } catch (error) {
    console.error('Error fetching market:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market', details: String(error) },
      { status: 500 }
    );
  }
}
