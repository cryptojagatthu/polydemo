// app/api/limit-orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    const id = Number(context.params.id);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const auth = req.headers.get("authorization");
    const token = auth?.split(" ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.userId !== decoded.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "OPEN") return NextResponse.json({ error: "Only OPEN orders can be cancelled" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // mark cancelled
      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });

      // If BUY: refund reservedBalance (limitPrice * qty)
      if (order.limitPrice != null) {
        const reservedAmount = order.limitPrice * order.quantity;
        // if user has reservedBalance, decrement and add back to demoBalance
        await tx.user.update({
          where: { id: order.userId },
          data: {
            reservedBalance: { decrement: reservedAmount } as any,
            demoBalance: { increment: reservedAmount } as any,
          },
        });
      }

      // If SELL: reduce reservedQuantity on position
      const pos = await tx.position.findFirst({ where: { userId: order.userId, marketId: order.marketId, side: order.side } });
      if (pos) {
        await tx.position.update({
          where: { id: pos.id },
          data: { reservedQuantity: Math.max(0, pos.reservedQuantity - order.quantity) },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cancel limit order error:", err);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
