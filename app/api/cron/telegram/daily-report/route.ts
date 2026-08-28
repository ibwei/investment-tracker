import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendConfiguredTelegramDailyReport } from "@/lib/telegram-daily-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getReferenceDate(request: Request) {
  const scheduledAt = request.headers.get("x-cron-scheduled-at");
  const parsed = scheduledAt ? new Date(scheduledAt) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json(
      await sendConfiguredTelegramDailyReport(getReferenceDate(request))
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Telegram daily report failed."
      },
      { status: (error as { status?: number })?.status ?? 500 }
    );
  }
}
