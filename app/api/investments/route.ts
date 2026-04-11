import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  clearAllInvestments,
  createInvestment,
  getDashboardSnapshot
} from "@/lib/investments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error) {
  const status = error?.status ?? 500;
  return NextResponse.json(
    {
      error: error?.message ?? "服务器处理失败。"
    },
    { status }
  );
}

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await getDashboardSnapshot(session.userId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const record = await createInvestment(session.userId, body);
    return NextResponse.json({
      record,
      snapshot: await getDashboardSnapshot(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    return NextResponse.json({
      snapshot: await clearAllInvestments(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
