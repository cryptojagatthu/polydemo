// app/api/simulate-prices/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Dev-only price simulator.
 * GET /api/simulate-prices
 *
 * For each market, we slightly nudge the YES price by a small random amount,
 * clamp between 0.05 and 0.95, and set NO = 1 - YES.
 *
 * This simulates price movement so you can test orders, PnL, limit orders, etc.
 */
export async function GET() {
  try {
    const markets = await prisma.marketCache.findMany();

    const updates = markets.map(async (m) => {
      // parse existing prices
      const prices = (() => {
        try {
          return JSON.parse(m.outcomePricesJson || '["0.5","0.5"]');
        } catch {
          return [0.5, 0.5];
        }
      })();

      // small random fluctuation: ± up to 3% absolute
      // You can tune the scale here (0.03 → 3%).
      const tweakScale = 0.03;

      let yes = parseFloat(prices[0]) + (Math.random() - 0.5) * tweakScale;
      // clamp between 0.05 and 0.95
      yes = Math.min(Math.max(yes, 0.05), 0.95);
      const no = parseFloat((1 - yes).toFixed(6));

      // update DB
      return prisma.marketCache.update({
        where: { id: m.id },
        data: {
          outcomePricesJson: JSON.stringify([Number(yes.toFixed(6)), no]),
          lastSynced: new Date(),
        },
      });
    });

    await Promise.all(updates);

    // Run order matcher
await fetch("http://localhost:3000/api/limit-orders/match", {
  method: "POST",
});


    return NextResponse.json({ success: true, updated: markets.length });
  } catch (err) {
    console.error('Price simulation error:', err);
    return NextResponse.json({ error: 'Failed to simulate prices' }, { status: 500 });
  }
}
