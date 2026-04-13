import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { syncAssetSource } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return NextResponse.json(await syncAssetSource(session.userId, Number(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
