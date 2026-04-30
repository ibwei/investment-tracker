import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
import { captureAssetSnapshot, listAssetSnapshots } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      snapshots: await listAssetSnapshots(session.userId, {
        days: searchParams.get("days"),
        startDate: searchParams.get("startDate"),
        endDate: searchParams.get("endDate"),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json({
      snapshot: await captureAssetSnapshot(session.userId),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
