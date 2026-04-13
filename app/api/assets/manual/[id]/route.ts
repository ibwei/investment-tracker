import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteManualAsset, updateManualAsset } from "@/lib/assets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handleRouteError(error: any) {
  return NextResponse.json(
    { error: error?.message ?? "Request failed." },
    { status: error?.status ?? 500 }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return NextResponse.json(
      await updateManualAsset(session.userId, Number(id), await request.json())
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return NextResponse.json(await deleteManualAsset(session.userId, Number(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
