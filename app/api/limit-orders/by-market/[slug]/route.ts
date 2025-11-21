import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  context: { params: { slug: string } }
) {
  try {
    const { slug } = context.params; // ✅ FIXED: no await

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    // ----- AUTH -----
    const auth = req.headers.get("authorization");
    const token = auth?.split(" ")[1];

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // ----- FIND MARKET -----
    const market = await prisma.marketCache.findUnique({
      where: { slug },
    });

    if (!market) {
      return NextResponse.json(
        { error: "Market not found" },
        { status: 404 }
      );
    }

    // ----- FETCH USER LIMIT ORDERS -----
    const orders = await prisma.order.findMany({
      where: {
        marketId: market.id,
        userId: decoded.userId,
        orderType: "LIMIT",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        side: true,       // YES / NO
        sideType: true,   // BUY / SELL ✅
        quantity: true,
        limitPrice: true,
        filledQty: true,
        fillPrice: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error("List orders error:", err);

    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
