import { NextResponse } from "next/server";
import { requireSameOriginSession } from "@/lib/auth";
import {
  getDashboardSnapshot,
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

export async function PATCH(request, context) {
  try {
    const session = await requireSameOriginSession(request);
    const id = parseId((await context.params).id);
    const body = await request.json();
    const record = await updateInvestment(session.userId, id, body);
    return NextResponse.json({
      record,
      snapshot: await getDashboardSnapshot(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const session = await requireSameOriginSession(request);
    const id = parseId((await context.params).id);
    const body = await request.json();
    await softDeleteInvestment(session.userId, id, body?.confirmationText);
    return NextResponse.json({
      success: true,
      snapshot: await getDashboardSnapshot(session.userId)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
