import { NextResponse } from "next/server";
import { requireSameOriginSession } from "@/lib/auth";
import { syncAllAssetSources } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export async function POST(request: Request) {
  try {
    const session = await requireSameOriginSession(request);
    return NextResponse.json(await syncAllAssetSources(session.userId));
  } catch (error) {
    return handleRouteError(error);
  }
}
