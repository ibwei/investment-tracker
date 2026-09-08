import { timedRoute } from "@/lib/performance";
import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
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

export const GET = timedRoute(async function (request) {
  try {
    const session = await requireSession();
    return NextResponse.json(await getDashboardSnapshot(session.userId, { compact: new URL(request.url).searchParams.get("response") === "delta" }));
  } catch (error) {
    return handleRouteError(error);
  }
});

export const POST = timedRoute(async function (request) {
  try {
    const session = await requireSameOriginSession(request);
    const body = await request.json();
    return NextResponse.json(await createInvestment(session.userId, body, { compact: new URL(request.url).searchParams.get("response") === "delta" }));
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = timedRoute(async function (request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json({
      snapshot: await clearAllInvestments(session.userId, { compact: new URL(request.url).searchParams.get("response") === "delta" })
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
