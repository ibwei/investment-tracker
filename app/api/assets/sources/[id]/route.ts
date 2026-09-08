import { timedRoute } from "@/lib/performance";
import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
import {
  deleteAssetSource,
  getAssetSource,
  updateAssetSource,
} from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export const GET = timedRoute(async function (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return NextResponse.json({
      source: await getAssetSource(session.userId, Number(id)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const PATCH = timedRoute(async function (
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSameOriginSession(request);
    const { id } = await context.params;
    return NextResponse.json(
      await updateAssetSource(session.userId, Number(id), await request.json())
    );
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = timedRoute(async function (
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSameOriginSession(request);
    const { id } = await context.params;
    return NextResponse.json(await deleteAssetSource(session.userId, Number(id)));
  } catch (error) {
    return handleRouteError(error);
  }
});
