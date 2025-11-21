// app/api/limit-orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.split(" ")[1];

    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();

    // BUY / SELL
    const possibleActions = ["BUY", "SELL"];
    const rawAction = (body.action || "").toString().toUpperCase();
    const action = possibleActions.includes(rawAction)
      ? (rawAction as "BUY" | "SELL")
      : null;

    // YES / NO side
    const outcomeSide = body.side?.toString().toUpperCase();

    const marketSlug = body.marketSlug || body.marketId;
    const quantity = Number(body.quantity);
    let lp = Number(body.limitPrice); // can be 5 or 0.05

    // ✅ Convert cents → decimal if > 1
    if (lp > 1) {
      lp = lp / 100;
    }

    // ✅ Enforce Polymarket range
    if (lp <= 0 || lp >= 1) {
      return NextResponse.json(
        { error: "Price must be between 1 and 99 cents" },
        { status: 400 }
      );
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (!marketSlug || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "marketSlug, quantity & limitPrice are required" },
        { status: 400 }
      );
    }

    if (!action)
      return NextResponse.json(
        { error: "action must be BUY or SELL" },
        { status: 400 }
      );

    if (!outcomeSide || !["YES", "NO"].includes(outcomeSide))
      return NextResponse.json(
        { error: "side must be YES or NO" },
        { status: 400 }
      );

    const qty = Math.floor(quantity);

    const market = await prisma.marketCache.findUnique({
      where: { slug: marketSlug },
    });

    if (!market || !market.active)
      return NextResponse.json(
        { error: "Market not available" },
        { status: 400 }
      );

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {

      // ===================== BUY LIMIT =====================
      if (action === "BUY") {
        const totalCost = qty * lp;

        if (user.demoBalance < totalCost) {
          throw new Error(
            `INSUFFICIENT_BALANCE: need ${totalCost.toFixed(2)}, have ${user.demoBalance.toFixed(2)}`
          );
        }

        await tx.user.update({
          where: { id: user.id },
          data: {
            demoBalance: { decrement: totalCost },
            reservedBalance: { increment: totalCost },
          },
        });


        const order = await tx.order.create({
          data: {
            userId: user.id,
            marketId: market.id,
            side: outcomeSide,
            sideType: "BUY",
            orderType: "LIMIT",
            quantity: qty,
            status: "OPEN",
            limitPrice: lp, // ✅ stored as decimal
            expiresAt,
          },
        });

        return { order };
      }

      // ===================== SELL LIMIT =====================
      const pos = await tx.position.findFirst({
        where: {
          userId: user.id,
          marketId: market.id,
          side: outcomeSide,
        },
      });

      const available =
        (pos?.quantity || 0) - (pos?.reservedQuantity || 0);

      if (!pos || available < qty)
        throw new Error(
          `INSUFFICIENT_SHARES: available ${available}, required ${qty}`
        );

      await tx.position.update({
        where: { id: pos.id },
        data: {
          reservedQuantity: (pos.reservedQuantity || 0) + qty, // ✅ lock shares
        },
      });

      const order = await tx.order.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side: outcomeSide,
          sideType: "SELL",
          orderType: "LIMIT",
          quantity: qty,
          status: "OPEN",
          limitPrice: lp, // ✅ stored as decimal
          expiresAt,
        },
      });

      return { order };
    });

    return NextResponse.json({ success: true, order: result.order });

  } catch (err: any) {
    console.error("Limit order error:", err);

    const msg = (err?.message || "").toString();

    if (msg.startsWith("INSUFFICIENT_BALANCE"))
      return NextResponse.json({ error: msg }, { status: 400 });

    if (msg.startsWith("INSUFFICIENT_SHARES"))
      return NextResponse.json({ error: msg }, { status: 400 });

    return NextResponse.json(
      { error: "Failed to place limit order" },
      { status: 500 }
    );
  }
}
