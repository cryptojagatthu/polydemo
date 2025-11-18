// app/api/limit-orders/match/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Dev / scheduler endpoint to run the matcher once.
 * POST or GET
 */
export async function GET() {
  try {
    const now = new Date();

    // Get all OPEN limit orders that are not expired
    const orders = await prisma.order.findMany({
      where: {
        orderType: "LIMIT",
        status: "OPEN",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      include: { market: true, user: true },
    });

    let executed = 0;
    for (const o of orders) {
      try {
        if (!o.market) continue;
        if (o.limitPrice == null) continue;

        const prices = JSON.parse(o.market.outcomePricesJson || '["0.5","0.5"]');
        const currentPrice = o.side === "YES" ? Number(prices[0]) : Number(prices[1]);
        const lp = Number(o.limitPrice);
        if (isNaN(currentPrice) || isNaN(lp)) continue;

        // Determine whether order is BUY or SELL from sideType column (recommended)
        // Fallback: if sideType is missing, infer by checking reservedBalance / reservedQuantity
        const orderSideType = (o.sideType || '').toUpperCase() || undefined;

        // Load the up-to-date user + position for reliable checks
        const user = await prisma.user.findUnique({ where: { id: o.userId } });
        const pos = await prisma.position.findFirst({
          where: { userId: o.userId, marketId: o.marketId, side: o.side },
        });

        const isBuyCandidate = orderSideType === "BUY"
          ? (user?.reservedBalance || 0) >= (o.quantity * lp - 1e-9)
          : (user?.reservedBalance || 0) >= (o.quantity * lp - 1e-9); // fallback same check

        const isSellCandidate = orderSideType === "SELL"
          ? (pos?.reservedQuantity || 0) >= (o.quantity - 1e-9)
          : (pos?.reservedQuantity || 0) >= (o.quantity - 1e-9); // fallback same check

        let shouldFill = false;
        if (isBuyCandidate && currentPrice <= lp) shouldFill = true;
        if (isSellCandidate && currentPrice >= lp) shouldFill = true;

        if (!shouldFill) continue;

        // Execute fill in transaction
        await prisma.$transaction(async (tx) => {
          // 1) Mark order FILLED
          const updatedOrder = await tx.order.update({
            where: { id: o.id },
            data: {
              status: "FILLED",
              filledQty: o.quantity,
              fillPrice: currentPrice,
            },
          });

          // 2) Create trade
          await tx.trade.create({
            data: {
              orderId: updatedOrder.id,
              userId: o.userId,
              marketId: o.marketId,
              side: o.side,
              quantity: o.quantity,
              price: currentPrice,
            },
          });

          // Fetch fresh user & pos inside tx
          const txUser = await tx.user.findUnique({ where: { id: o.userId } });
          const txPos = await tx.position.findFirst({
            where: { userId: o.userId, marketId: o.marketId, side: o.side },
          });

          // === BUY order fill ===
          if (isBuyCandidate) {
            const cost = currentPrice * o.quantity;
            const reservedAmountHeld = lp * o.quantity; // amount that was reserved at order creation
            // Use current txUser.reservedBalance to avoid making it negative
            const reservedNow = txUser?.reservedBalance || 0;
            const toDecrement = Math.min(reservedNow, reservedAmountHeld);

            const refund = Math.max(0, reservedAmountHeld - cost); // refund any leftover because limitPrice > fill price

            // Update balances safely
            await tx.user.update({
              where: { id: o.userId },
              data: {
                reservedBalance: { decrement: toDecrement } as any,
                demoBalance: { increment: refund } as any,
              },
            });

            // Add or update position (give shares)
            if (txPos) {
              const newQty = txPos.quantity + o.quantity;
              const newAvg = (txPos.avgPrice * txPos.quantity + currentPrice * o.quantity) / newQty;
              await tx.position.update({
                where: { id: txPos.id },
                data: { quantity: newQty, avgPrice: newAvg },
              });
            } else {
              await tx.position.create({
                data: {
                  userId: o.userId,
                  marketId: o.marketId,
                  side: o.side,
                  avgPrice: currentPrice,
                  quantity: o.quantity,
                },
              });
            }
          }

          // === SELL order fill ===
          if (isSellCandidate) {
            const proceeds = currentPrice * o.quantity;

            // txPos must exist because we reserved earlier; but guard just in case
            if (txPos) {
              // Decrement reservedQuantity and decrement actual quantity (remove sold shares)
              await tx.position.update({
                where: { id: txPos.id },
                data: {
                  reservedQuantity: Math.max(0, (txPos.reservedQuantity || 0) - o.quantity),
                  quantity: Math.max(0, (txPos.quantity || 0) - o.quantity),
                },
              });
            }

            // Credit user proceed to demoBalance
            await tx.user.update({
              where: { id: o.userId },
              data: { demoBalance: { increment: proceeds } as any },
            });
          }
        });

        executed++;
      } catch (innerErr) {
        console.warn("Matcher inner error for order", o.id, innerErr);
        continue;
      }
    }

    return NextResponse.json({ success: true, executed });
  } catch (err) {
    console.error("Matcher error:", err);
    return NextResponse.json({ error: "Matcher failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET();
}
