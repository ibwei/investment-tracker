import { timedRoute } from "@/lib/performance";
import { NextResponse } from "next/server";
import { requireSameOriginSession } from "@/lib/auth";
import {
  softDeleteInvestment,
  updateInvestment
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

function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("无效的记录 ID。");
    error.status = 400;
    throw error;
  }
  return id;
}

export const PATCH = timedRoute(async function (request, context) {
  try {
    const session = await requireSameOriginSession(request);
    const id = parseId((await context.params).id);
    const body = await request.json();
    return NextResponse.json(await updateInvestment(session.userId, id, body, { compact: new URL(request.url).searchParams.get("response") === "delta" }));
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = timedRoute(async function (request, context) {
  try {
    const session = await requireSameOriginSession(request);
    const id = parseId((await context.params).id);
    const body = await request.json();
    return NextResponse.json({
      success: true,
      snapshot: await softDeleteInvestment(session.userId, id, body?.confirmationText, { compact: new URL(request.url).searchParams.get("response") === "delta" })
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
