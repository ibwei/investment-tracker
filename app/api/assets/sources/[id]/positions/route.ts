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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      positions: await listAssetPositions(session.userId, {
        sourceId: id,
        limit: searchParams.get("limit"),
        offset: searchParams.get("offset"),
        sort: searchParams.get("sort"),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
