import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId, marketId } = await req.json();

    const bookmark = await prisma.bookmark.upsert({
      where: { userId_marketId: { userId, marketId } },
      update: {},
      create: { userId, marketId },
    });

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error('Error bookmarking:', error);
    return NextResponse.json(
      { error: 'Failed to bookmark' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = parseInt(searchParams.get('userId') || '0');
    const marketId = searchParams.get('marketId') || '';

    await prisma.bookmark.delete({
      where: { userId_marketId: { userId, marketId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = parseInt(searchParams.get('userId') || '0');

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      include: { market: true },
    });

    return NextResponse.json({ success: true, bookmarks });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}
