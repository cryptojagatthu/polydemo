import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();

    const orders = await prisma.order.findMany({
      where: {
        status: "OPEN",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      include: { market: true },
    });

    let executed = 0;

    for (const o of orders) {
      try {
        if (!o.market || o.limitPrice == null) continue;

        // --- Load market prices ---
        const prices = JSON.parse(
          o.market.outcomePricesJson || '["0.5","0.5"]'
        );

        let currentPrice =
          o.side === "YES"
            ? Number(prices[0])
            : Number(prices[1]);

        let limitPrice = Number(o.limitPrice);

        // ✅ Normalize to Polymarket decimal system
        // If someone stored 5 instead of 0.05, convert it
        if (currentPrice > 1) currentPrice = currentPrice / 100;
        if (limitPrice > 1) limitPrice = limitPrice / 100;

        if (isNaN(currentPrice) || isNaN(limitPrice)) continue;

        const sideType = o.sideType?.toUpperCase();
        if (!sideType) continue;

        const user = await prisma.user.findUnique({
          where: { id: o.userId },
        });

        const pos = await prisma.position.findFirst({
          where: {
            userId: o.userId,
            marketId: o.marketId,
            side: o.side,
          },
        });

        const isBuy =
          sideType === "BUY" &&
          (user?.reservedBalance || 0) >= limitPrice * o.quantity;

        const isSell =
          sideType === "SELL" &&
          (pos?.reservedQuantity || 0) >= o.quantity;

        let shouldFill = false;

        // ✅ Polymarket execution logic
        if (isBuy && currentPrice <= limitPrice) shouldFill = true;
        if (isSell && currentPrice >= limitPrice) shouldFill = true;

        if (!shouldFill) continue;

        await prisma.$transaction(async (tx) => {

          // -------- Mark Order FILLED --------
          await tx.order.update({
            where: { id: o.id },
            data: {
              status: "FILLED",
              filledQty: o.quantity,
              fillPrice: currentPrice,
            },
          });

          // -------- Create Trade Record --------
          await tx.trade.create({
            data: {
              orderId: o.id,
              userId: o.userId,
              marketId: o.marketId,
              side: o.side,
              quantity: o.quantity,
              price: currentPrice,
            },
          });

          const txUser = await tx.user.findUnique({
            where: { id: o.userId },
          });

          const txPos = await tx.position.findFirst({
            where: {
              userId: o.userId,
              marketId: o.marketId,
              side: o.side,
            },
          });

          // ---------- BUY LIMIT FILLED ----------
          if (isBuy) {
            const cost = currentPrice * o.quantity;
            const reserved = limitPrice * o.quantity;

            const reservedNow = txUser?.reservedBalance || 0;
            const toDecrement = Math.min(reserved, reservedNow);
            const refund = Math.max(0, reserved - cost);

            await tx.user.update({
              where: { id: o.userId },
              data: {
                reservedBalance: { decrement: toDecrement },
                demoBalance: { increment: refund },
              },
            });

            if (txPos) {
              const newQty = txPos.quantity + o.quantity;
              const newAvg =
                (txPos.avgPrice * txPos.quantity +
                  currentPrice * o.quantity) / newQty;

              await tx.position.update({
                where: { id: txPos.id },
                data: {
                  quantity: newQty,
                  avgPrice: newAvg,
                },
              });
            } else {
              await tx.position.create({
                data: {
                  userId: o.userId,
                  marketId: o.marketId,
                  side: o.side,
                  quantity: o.quantity,
                  avgPrice: currentPrice,
                },
              });
            }
          }

          // ---------- SELL LIMIT FILLED ----------
          if (isSell && txPos) {
            const proceeds = currentPrice * o.quantity;

            const newQty = Math.max(0, (txPos.quantity || 0) - o.quantity);
            const newReserved = Math.max(0, (txPos.reservedQuantity || 0) - o.quantity);

            await tx.position.update({
              where: { id: txPos.id },
              data: {
                quantity: newQty,
                reservedQuantity: newReserved,
              },
            });

            await tx.user.update({
              where: { id: o.userId },
              data: {
                demoBalance: { increment: proceeds },
              },
            });
          }
        });

        executed++;
      } catch (err) {
        console.warn("Matcher error for order", o.id, err);
      }
    }

    return NextResponse.json({ success: true, executed });
  } catch (err) {
    console.error("Matcher main error:", err);
    return NextResponse.json(
      { error: "Matcher failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
