import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
import {
  captureUserSnapshots,
  listPortfolioSnapshots
} from "@/lib/snapshot-history";

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

export async function GET(request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days") ?? undefined;
    const startDate = searchParams.get("startDate") ?? undefined;

    return NextResponse.json({
      snapshots: await listPortfolioSnapshots(session.userId, { days, startDate })
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json({
      snapshot: await captureUserSnapshots(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
