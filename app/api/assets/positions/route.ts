import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listAssetPositions } from "@/lib/assets/service";

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
      positions: await listAssetPositions(session.userId, {
        limit: searchParams.get("limit"),
        offset: searchParams.get("offset"),
        sourceId: searchParams.get("sourceId"),
        chain: searchParams.get("chain"),
        protocol: searchParams.get("protocol"),
        positionType: searchParams.get("positionType"),
        sort: searchParams.get("sort"),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
