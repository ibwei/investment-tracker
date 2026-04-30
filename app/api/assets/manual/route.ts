import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
import { createManualAsset, listManualAssets } from "@/lib/assets/service";

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
      assets: await listManualAssets(session.userId, {
        limit: searchParams.get("limit"),
        offset: searchParams.get("offset"),
        type: searchParams.get("type"),
        q: searchParams.get("q"),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json(await createManualAsset(session.userId, await request.json()));
  } catch (error) {
    return handleRouteError(error);
  }
}
