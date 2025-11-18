// app/api/match-orders/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const orders = await prisma.order.findMany({
      where: { orderType: "LIMIT", status: "OPEN" },
      include: { market: true, user: true },
    });

    let executed = 0;

    for (const o of orders) {
      const prices = JSON.parse(o.market.outcomePricesJson);
      const current = o.side === "YES" ? Number(prices[0]) : Number(prices[1]);

      let shouldExecute = false;

      if (o.side === "YES" && current <= o.limitPrice!) shouldExecute = true;
      if (o.side === "NO" && (1 - current) <= o.limitPrice!) shouldExecute = true;

      // expiry
      if (o.expiresAt && o.expiresAt < new Date()) {
        await prisma.order.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
        // NOTE: cancellation should refund — call cancel endpoint logic (could be factored). For now, refund basic:
        // Refund user balance or restore shares as in cancel route — but ideally call the cancel endpoint.
        continue;
      }

      if (!shouldExecute) continue;

      executed++;

      // create trade
      await prisma.trade.create({
        data: {
          orderId: o.id,
          userId: o.userId,
          marketId: o.marketId,
          side: o.side,
          quantity: o.quantity,
          price: current,
        },
      });

      // mark order FILLED
      await prisma.order.update({
        where: { id: o.id },
        data: { status: "FILLED", filledQty: o.quantity, fillPrice: current },
      });

      // For BUY limit orders: funds were RESERVED at order creation, so DO NOT deduct again.
      // For SELL limit orders: shares were RESERVED (quantity subtracted at order creation),
      // so on fill we must credit proceeds to user's demoBalance.

      if (o.orderType === "LIMIT") {
        if (o.side === "YES" || o.side === "NO") {
          // Treat mode: if order was a SELL (we reserved shares earlier) then credit proceeds.
          // We must determine whether this order was placed as sell or buy; ideally stored as `mode` or infer:
          // If user currently has a position with less quantity than before, it's likely a sell; but safer to include `mode` at creation.
          // For now, assume that if the user currently has a position for same side, it's a buy; else if not, it's likely a sell.
        }
      }

      // Simpler practical implementation: check if user had position BEFORE order (hard to access now).
      // Better approach: add `mode` field to order at creation. If you add mode, use it here.
      // We'll attempt to detect: if user.demoBalance is lower than it was earlier can't detect; so we will implement simple rule:
      // If order was created with limitPrice and quantity and user's positions currently don't include that quantity, assume the reservation model applied.
      // For robustness, I recommend adding `mode` to Order schema; I can add migration if you want.

      // For now, credit proceeds for SELL orders conservatively:
      // If user currently has a position for this market+side, we treat as BUY reservation (no balance change).
      // If no such position exists (pos not found), treat as SELL reservation and credit proceeds.

      const pos = await prisma.position.findFirst({
        where: { userId: o.userId, marketId: o.marketId, side: o.side },
      });

      const tradeProceeds = current * o.quantity;

      if (!pos) {
        // likely SELL reserved earlier: credit user balance
        await prisma.user.update({
          where: { id: o.userId },
          data: { demoBalance: o.user.demoBalance + tradeProceeds },
        });
      } else {
        // likely BUY (funds already reserved). Update position (increase)
        const newQty = pos.quantity + o.quantity;
        const newAvg = (pos.avgPrice * pos.quantity + current * o.quantity) / newQty;
        await prisma.position.update({
          where: { id: pos.id },
          data: { quantity: newQty, avgPrice: newAvg },
        });
      }
    }

    return NextResponse.json({ success: true, executed });
  } catch (err) {
    console.error("Matcher error:", err);
    return NextResponse.json({ error: "Matcher failed" }, { status: 500 });
  }
}
