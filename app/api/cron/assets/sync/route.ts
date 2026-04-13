import { NextResponse } from "next/server";
import { captureAssetsForAllUsers } from "@/lib/assets/service";
import { writeScheduledJobLog } from "@/lib/snapshot-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const bearerToken = getBearerToken(request);
  const headerToken = request.headers.get("x-cron-secret") ?? "";
  return bearerToken === secret || headerToken === secret;
}

function toHourlyRunKey(value = new Date()) {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  const startedAt = new Date();
  const runDate = toHourlyRunKey(startedAt);

  try {
    const result = await captureAssetsForAllUsers(startedAt);
    const finishedAt = new Date();

    await writeScheduledJobLog({
      jobName: "asset-source-sync",
      runDate,
      status: "SUCCESS",
      processedCount: result.processedCount,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const finishedAt = new Date();

    await writeScheduledJobLog({
      jobName: "asset-source-sync",
      runDate,
      status: "FAILED",
      processedCount: 0,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      errorMessage: error?.message ?? "Asset source sync failed.",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });

    return NextResponse.json(
      { error: error?.message ?? "Request failed." },
      { status: error?.status ?? 500 }
    );
  }
}
