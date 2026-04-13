import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { syncAllAssetSources } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export async function POST() {
  try {
    const session = await requireSession();
    return NextResponse.json(await syncAllAssetSources(session.userId));
  } catch (error) {
    return handleRouteError(error);
  }
}
