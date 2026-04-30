import { NextResponse } from "next/server";
import { requireSameOriginSession, requireSession } from "@/lib/auth";
import { createAssetSource, listAssetSources } from "@/lib/assets/service";

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
      sources: await listAssetSources(session.userId, {
        status: searchParams.get("status"),
        type: searchParams.get("type"),
        limit: searchParams.get("limit"),
        offset: searchParams.get("offset"),
        sort: searchParams.get("sort"),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json(await createAssetSource(session.userId, await request.json()));
  } catch (error) {
    return handleRouteError(error);
  }
}
