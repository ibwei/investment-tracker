import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { proxyCexDexServiceGet } from "@/lib/assets/cex-dex-service-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const payload = await proxyCexDexServiceGet(
      `/api/diagnostics/egress${query ? `?${query}` : ""}`
    );
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Request failed." },
      { status: error?.status ?? 500 }
    );
  }
}
