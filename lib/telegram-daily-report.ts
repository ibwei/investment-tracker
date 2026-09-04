import { syncAllAssetSources } from "@/lib/assets/service";
import {
  claimScheduledJobRun,
  finishClaimedScheduledJobRun,
  getDailyIncomeSnapshot,
  markClaimedScheduledJobSending
} from "@/lib/snapshot-history";
import { isTelegramReminderConfigured, sendTelegramMessage } from "@/lib/telegram";
import { getUsdExchangeRate } from "@/lib/exchange-rate";
import { toAppDateKey } from "@/lib/time";
import { getUserByEmail } from "@/lib/users";

const REPORT_TIME_ZONE = "Asia/Shanghai";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const USD_EQUIVALENT_INCOME_CURRENCIES = new Set(["USD", "USDC", "USDT"]);

function createReportError(message: string, status = 500) {
  return Object.assign(new Error(message), { status });
}

function getTargetUserEmail() {
  const email = process.env.TELEGRAM_REPORT_USER_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw createReportError("TELEGRAM_REPORT_USER_EMAIL is required.");
  }

  return email;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatCny(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function totalsMatch(left: number, right: number) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(left) * 1e-9);
}

export function buildTelegramDailyReportText({
  estimatedIncomeUsd,
  incomeUnavailableReason,
  assetTotalUsd,
  assetTotalCny,
  usdToCnyRate,
  hasAssetSyncIssues
}: {
  estimatedIncomeUsd: number | null;
  incomeUnavailableReason:
    | "NO_DATA"
    | "UNSUPPORTED_CURRENCY"
    | "INCOMPLETE_SNAPSHOT"
    | null;
  assetTotalUsd: number;
  assetTotalCny: number | null;
  usdToCnyRate: number | null;
  hasAssetSyncIssues: boolean;
}) {
  const incomeText = incomeUnavailableReason === "UNSUPPORTED_CURRENCY"
    ? "非美元口径，无法汇总"
    : incomeUnavailableReason === "INCOMPLETE_SNAPSHOT"
      ? "历史口径不完整，无法汇总"
      : incomeUnavailableReason === "NO_DATA" || estimatedIncomeUsd === null
        ? "暂无昨日数据"
        : formatUsd(estimatedIncomeUsd);
  const assetIssueSuffix = hasAssetSyncIssues ? "（部分来源未刷新）" : "";
  const cnyAssetText = assetTotalCny === null || usdToCnyRate === null
    ? "汇率暂不可用"
    : `${formatCny(assetTotalCny)}（USD/CNY ${usdToCnyRate.toFixed(4)}）`;

  return [
    `昨日预计理财收入：${incomeText}`,
    `资产合计（美元）：${formatUsd(assetTotalUsd)}${assetIssueSuffix}`,
    `资产合计（人民币折算）：${cnyAssetText}${assetIssueSuffix}`
  ].join("\n");
}

export async function sendConfiguredTelegramDailyReport(referenceDate = new Date()) {
  const targetEmail = getTargetUserEmail();
  const user = await getUserByEmail(targetEmail);

  if (!user || user.status !== "ACTIVE" || user.storageMode !== "REMOTE") {
    throw createReportError("Configured Telegram report user is unavailable.");
  }

  if (user.timezone !== REPORT_TIME_ZONE) {
    throw createReportError("Configured Telegram report user must use Asia/Shanghai timezone.");
  }

  const reportDate = toAppDateKey(referenceDate, REPORT_TIME_ZONE);
  const yesterdayDate = toAppDateKey(
    new Date(referenceDate.getTime() - ONE_DAY_MS),
    REPORT_TIME_ZONE
  );
  const jobName = `telegram-daily-report:user:${user.id}`;
  const startedAt = new Date();
  const claimedAt = startedAt.toISOString();
  const claimedRun = await claimScheduledJobRun({
    jobName,
    runDate: reportDate,
    startedAt: claimedAt
  });

  if (!claimedRun) {
    return {
      status: "SKIPPED",
      reason: "ALREADY_CLAIMED",
      reportDate
    };
  }

  let deliveryStarted = false;

  try {
    const [assetSyncResult, incomeSnapshot, usdToCnyExchangeRate] = await Promise.all([
      syncAllAssetSources(user.id),
      getDailyIncomeSnapshot(user.id, yesterdayDate),
      getUsdExchangeRate("CNY").catch(() => null)
    ]);
    const hasIncompleteIncomeSnapshot = Boolean(
      incomeSnapshot && (
        incomeSnapshot.activeInvestmentCount !== incomeSnapshot.snapshotInvestmentCount ||
        incomeSnapshot.missingCurrencyCount > 0 ||
        !totalsMatch(
          incomeSnapshot.totalIncomeDaily,
          incomeSnapshot.calculatedIncomeDaily
        )
      )
    );
    const hasUnsupportedIncomeCurrency = Boolean(incomeSnapshot?.incomeCurrencies.some(
      (currency) => !USD_EQUIVALENT_INCOME_CURRENCIES.has(currency)
    ));
    const incomeUnavailableReason = !incomeSnapshot
      ? "NO_DATA"
      : hasIncompleteIncomeSnapshot
        ? "INCOMPLETE_SNAPSHOT"
        : hasUnsupportedIncomeCurrency
          ? "UNSUPPORTED_CURRENCY"
          : null;
    const estimatedIncomeUsd = incomeUnavailableReason === null
      ? incomeSnapshot.totalIncomeDaily
      : null;
    const assetTotalUsd = Number(assetSyncResult.summary.summary.totalValueUsd ?? 0);
    if (!Number.isFinite(assetTotalUsd)) {
      throw createReportError("Asset total is unavailable.");
    }
    const usdToCnyRate = usdToCnyExchangeRate?.rate ?? null;
    const assetTotalCny = usdToCnyRate === null
      ? null
      : assetTotalUsd * usdToCnyRate;
    if (!isTelegramReminderConfigured()) {
      throw createReportError("Telegram bot configuration is unavailable.");
    }

    const sendingRun = await markClaimedScheduledJobSending({
      jobName,
      runDate: reportDate,
      claimedAt
    });
    if (!sendingRun) {
      throw createReportError("Telegram daily report lease was lost.", 409);
    }
    deliveryStarted = true;

    const telegramResult = await sendTelegramMessage({
      text: buildTelegramDailyReportText({
        estimatedIncomeUsd,
        incomeUnavailableReason,
        assetTotalUsd,
        assetTotalCny,
        usdToCnyRate,
        hasAssetSyncIssues: assetSyncResult.summary.summary.failedSourceCount > 0
      })
    });

    if (telegramResult.messageIds.length === 0) {
      throw createReportError("Telegram did not return a message id.", 502);
    }
    const finishedAt = new Date();
    const finishedRun = await finishClaimedScheduledJobRun({
      jobName,
      runDate: reportDate,
      claimedAt,
      status: "SUCCESS",
      processedCount: 1,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      finishedAt: finishedAt.toISOString()
    });
    if (!finishedRun) {
      throw createReportError("Telegram daily report lease was lost.", 409);
    }

    return {
      status: "SENT",
      reportDate,
      yesterdayDate,
      messageIds: telegramResult.messageIds
    };
  } catch (error) {
    const finishedAt = new Date();
    try {
      await finishClaimedScheduledJobRun({
        jobName,
        runDate: reportDate,
        claimedAt,
        status: deliveryStarted ? "DELIVERY_UNKNOWN" : "FAILED",
        processedCount: 0,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorMessage: error instanceof Error ? error.message : "Telegram daily report failed.",
        finishedAt: finishedAt.toISOString()
      });
    } catch {
      // Preserve the delivery error; a database failure will remain visible in Worker logs.
    }
    throw error;
  }
}
