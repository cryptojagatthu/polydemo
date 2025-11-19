// app/api/limit-orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Normalize params (supports Promise or plain)
    const { id } = await Promise.resolve(params);
    const orderId = Number(id);

    if (!orderId)
      return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Auth
    const auth = req.headers.get("authorization");
    const token = auth?.split(" ")[1];
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Fetch order — SELECT fields explicitly (fixes Render build)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        marketId: true,
        side: true,
        orderType: true,
        sideType: true,
        quantity: true,
        filledQty: true,
        fillPrice: true,
        status: true,
        limitPrice: true,   // <-- REQUIRED FIX
      },
    });

    if (!order)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.userId !== decoded.userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (order.status !== "OPEN")
      return NextResponse.json(
        { error: "Only OPEN orders can be cancelled" },
        { status: 400 }
      );

    // Transaction: cancel order + balance adjustments
    await prisma.$transaction(async (tx) => {
      // Mark order cancelled
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });

      // If BUY limit order: refund reservedBalance
      if (order.limitPrice != null) {
        const reservedAmount = order.limitPrice * order.quantity;

        await tx.user.update({
          where: { id: order.userId },
          data: {
            reservedBalance: { decrement: reservedAmount },
            demoBalance: { increment: reservedAmount },
          },
        });
      }

      // Release reserved quantity for SELL orders
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
              pos.reservedQuantity - order.quantity
            ),
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cancel limit order error:", err);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
