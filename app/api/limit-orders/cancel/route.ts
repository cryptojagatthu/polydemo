// app/api/limit-orders/cancel/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.split(" ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.userId !== decoded.userId)
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (order.status !== "OPEN")
      return NextResponse.json({ error: "Order cannot be cancelled" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      if (order.sideType === "BUY") {
        const refund = (order.limitPrice ?? 0) * order.quantity;

        await tx.user.update({
          where: { id: order.userId },
          data: {
            demoBalance: { increment: refund },
            reservedBalance: { decrement: refund },
          },
        });
      }

      if (order.sideType === "SELL") {
        const pos = await tx.position.findFirst({
          where: {
            userId: order.userId,
            marketId: order.marketId,
            side: order.side,
          },
        });

        if (pos) {
          await tx.position.update({
            where: { id: pos.id },
            data: {
              reservedQuantity: Math.max(
                0,
                (pos.reservedQuantity ?? 0) - order.quantity
              ),
            },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Cancel order error:", err);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}
