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

    // Extract BUY/SELL
    const possibleActions = ["BUY", "SELL"];
    const rawAction = (body.action || body.side || "").toString().toUpperCase();
    const action = possibleActions.includes(rawAction)
      ? (rawAction as "BUY" | "SELL")
      : null;

    // Extract outcome (YES/NO)
    const outcomeSide =
      body.side &&
      !possibleActions.includes(body.side.toString().toUpperCase())
        ? body.side.toString().toUpperCase()
        : body.outcome || body.sideOutcome || null;

    const marketSlug = body.marketSlug || body.marketId;
    const quantity = Number(body.quantity);
    const limitPrice = Number(body.limitPrice);
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (
      !marketSlug ||
      !quantity ||
      quantity <= 0 ||
      !limitPrice ||
      limitPrice <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "marketSlug, side/outcome, quantity, and limitPrice required (and must be valid numbers)",
        },
        { status: 400 }
      );
    }

    if (!action)
      return NextResponse.json(
        { error: "action must be BUY or SELL" },
        { status: 400 }
      );

    if (!outcomeSide)
      return NextResponse.json(
        { error: "outcome side required (YES/NO)" },
        { status: 400 }
      );

    const sideOutcome = outcomeSide.toString().toUpperCase();
    const qty = Math.floor(quantity);
    const lp = Number(limitPrice);

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

    // --- TRANSACTION ---
    const result = await prisma.$transaction(async (tx) => {
      if (action === "BUY") {
        // BUY limit
        const totalCost = qty * lp;

        if (user.demoBalance < totalCost)
          throw new Error(
            `INSUFFICIENT_BALANCE: need ${totalCost.toFixed(
              2
            )}, have ${user.demoBalance.toFixed(2)}`
          );

        await tx.user.update({
          where: { id: user.id },
          data: {
            demoBalance: user.demoBalance - totalCost,
            reservedBalance: { increment: totalCost } as any,
          },
        });

        const order = await tx.order.create({
          data: {
            userId: user.id,
            marketId: market.id,
            side: sideOutcome,
            sideType: "BUY", // ← IMPORTANT
            orderType: "LIMIT",
            quantity: qty,
            status: "OPEN",
            limitPrice: lp,
            expiresAt,
          },
        });

        return { order };
      }

      // SELL limit
      const pos = await tx.position.findFirst({
        where: {
          userId: user.id,
          marketId: market.id,
          side: sideOutcome,
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
    reservedQuantity: (pos.reservedQuantity || 0) + qty, // reserve only
  },
});



      const order = await tx.order.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side: sideOutcome,
          sideType: "SELL", // ← IMPORTANT
          orderType: "LIMIT",
          quantity: qty,
          status: "OPEN",
          limitPrice: lp,
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
