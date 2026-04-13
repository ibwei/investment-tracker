import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { formatInAppTimeZone } from "@/lib/time";

const REMINDER_WINDOW_HOURS = 24;

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value, timeZone) {
  return formatInAppTimeZone(
    value,
    "zh-CN",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    },
    timeZone
  );
}

function formatAmount(value, currency) {
  const amount = Number(value || 0);
  const normalizedCurrency = String(currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 6
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("zh-CN", {
      maximumFractionDigits: 6
    })} ${normalizedCurrency}`;
  }
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${Number(value || 0).toFixed(2)}%`;
}

function buildDashboardUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  return baseUrl ? new URL("/", baseUrl).toString() : "";
}

function sortInvestmentsByEndTime(investments) {
  return [...investments].sort((left, right) => {
    const leftEndTime = toDate(left.endTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightEndTime = toDate(right.endTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftEndTime - rightEndTime || (left.id ?? 0) - (right.id ?? 0);
  });
}

function splitInvestmentsByExpiryWindow(investments, now, windowEnd) {
  const expiringInvestments = [];
  const otherActiveInvestments = [];

  for (const investment of investments) {
    const endTime = toDate(investment.endTime);
    if (
      endTime &&
      endTime.getTime() > now.getTime() &&
      endTime.getTime() <= windowEnd.getTime()
    ) {
      expiringInvestments.push(investment);
    } else {
      otherActiveInvestments.push(investment);
    }
  }

  return {
    expiringInvestments: sortInvestmentsByEndTime(expiringInvestments),
    otherActiveInvestments: sortInvestmentsByEndTime(otherActiveInvestments)
  };
}

function buildTableRows(investments, timeZone) {
  return investments
    .map((investment) => {
      const endTime = investment.endTime ? formatDateTime(investment.endTime, timeZone) : "-";
      return `
        <tr>
          <td>${escapeHtml(investment.project)}</td>
          <td>${escapeHtml(investment.assetName)}</td>
          <td>${escapeHtml(investment.type)}</td>
          <td style="text-align:right;">${escapeHtml(formatAmount(investment.amount, investment.currency))}</td>
          <td>${escapeHtml(endTime)}</td>
          <td style="text-align:right;">${escapeHtml(formatPercent(investment.aprExpected))}</td>
          <td>${escapeHtml(investment.remark || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function buildInvestmentTable(investments, timeZone) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:left;">项目</th>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:left;">资产</th>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:left;">类型</th>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:right;">投入金额</th>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:left;">到期时间</th>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:right;">预期 APR</th>
          <th style="border:1px solid #e5e7eb;background:#f3f4f6;padding:10px;text-align:left;">备注</th>
        </tr>
      </thead>
      <tbody>
        ${buildTableRows(investments, timeZone)}
      </tbody>
    </table>
  `;
}

export function buildEmailHtml({
  user,
  investments,
  windowEnd,
  referenceDate = new Date()
}) {
  const dashboardUrl = buildDashboardUrl();
  const timeZone = user.timezone;
  const now = toDate(referenceDate) || new Date();
  const {
    expiringInvestments,
    otherActiveInvestments
  } = splitInvestmentsByExpiryWindow(investments, now, windowEnd);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>投资到期提醒</title>
      </head>
      <body style="margin:0;background:#f6f7f9;color:#1f2937;font-family:Arial,'Microsoft YaHei',sans-serif;">
        <div style="max-width:760px;margin:0 auto;padding:32px 20px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;color:#111827;">投资到期提醒</h1>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.7;">
              你好${user.name ? `，${escapeHtml(user.name)}` : ""}。你当前有
              <strong>${investments.length}</strong>
              笔活跃投资，其中
              <strong>${expiringInvestments.length}</strong>
              笔将在
              <strong>${escapeHtml(formatDateTime(windowEnd, timeZone))}</strong>
              前到期。
            </p>
            <h2 style="margin:22px 0 10px;font-size:16px;line-height:1.4;color:#111827;">24 小时内到期</h2>
            ${
              expiringInvestments.length > 0
                ? buildInvestmentTable(expiringInvestments, timeZone)
                : `<p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">未来 24 小时内暂无到期投资。</p>`
            }
            <h2 style="margin:22px 0 10px;font-size:16px;line-height:1.4;color:#111827;">其他活跃投资</h2>
            ${
              otherActiveInvestments.length > 0
                ? buildInvestmentTable(otherActiveInvestments, timeZone)
                : `<p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">暂无其他活跃投资。</p>`
            }
            ${
              dashboardUrl
                ? `<p style="margin:20px 0 0;font-size:14px;"><a href="${escapeHtml(dashboardUrl)}" style="color:#2563eb;">打开 CeFiDeFi 仪表盘</a></p>`
                : ""
            }
          </div>
        </div>
      </body>
    </html>
  `;
}

export function buildEmailText({
  user,
  investments,
  windowEnd,
  referenceDate = new Date()
}) {
  const now = toDate(referenceDate) || new Date();
  const {
    expiringInvestments,
    otherActiveInvestments
  } = splitInvestmentsByExpiryWindow(investments, now, windowEnd);
  const lines = [
    "投资到期提醒",
    "",
    `你好${user.name ? `，${user.name}` : ""}。你当前有 ${investments.length} 笔活跃投资，其中 ${expiringInvestments.length} 笔将在 ${formatDateTime(windowEnd, user.timezone)} 前到期。`,
    "",
    "24 小时内到期：",
    expiringInvestments.length > 0 ? "" : "未来 24 小时内暂无到期投资。",
  ];

  for (const investment of expiringInvestments) {
    lines.push(
      `- ${investment.project} / ${investment.assetName} / ${investment.type} / ${formatAmount(
        investment.amount,
        investment.currency
      )} / 到期时间：${investment.endTime ? formatDateTime(investment.endTime, user.timezone) : "-"} / 预期 APR：${formatPercent(
        investment.aprExpected
      )}`
    );
  }

  lines.push(
    "",
    "其他活跃投资：",
    otherActiveInvestments.length > 0 ? "" : "暂无其他活跃投资。",
    ""
  );

  for (const investment of otherActiveInvestments) {
    lines.push(
      `- ${investment.project} / ${investment.assetName} / ${investment.type} / ${formatAmount(
        investment.amount,
        investment.currency
      )} / 到期时间：${investment.endTime ? formatDateTime(investment.endTime, user.timezone) : "-"} / 预期 APR：${formatPercent(
        investment.aprExpected
      )}`
    );
  }

  return lines.join("\n");
}

function groupInvestmentsByUser(investments) {
  const groups = new Map();

  for (const investment of investments) {
    if (!investment.user?.email) {
      continue;
    }

    const userId = investment.user.id;
    if (!groups.has(userId)) {
      groups.set(userId, {
        user: investment.user,
        investments: []
      });
    }

    groups.get(userId).investments.push(investment);
  }

  return [...groups.values()];
}

export async function sendExpiringInvestmentReminders(referenceDate = new Date()) {
  const now = toDate(referenceDate) || new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const expiringCandidates = await query(
    `
      select
        investments.id,
        investments.project,
        investments.asset_name as "assetName",
        investments.type,
        investments.amount,
        investments.currency,
        investments.apr_expected as "aprExpected",
        investments.end_time as "endTime",
        investments.remark,
        json_build_object(
          'id', users.id,
          'email', users.email,
          'name', users.name,
          'timezone', users.timezone
        ) as "user"
      from investments
      join users on users.id = investments.user_id
      where investments.is_deleted = false
        and investments.status = 'ONGOING'
        and users.status = 'ACTIVE'
        and investments.end_time is not null
        and investments.end_time::timestamptz > $1::timestamptz
        and investments.end_time::timestamptz <= $2::timestamptz
      order by investments.id asc
    `,
    [now.toISOString(), windowEnd.toISOString()]
  );

  const expiringGroups = groupInvestmentsByUser(expiringCandidates);

  if (expiringGroups.length === 0) {
    return {
      checkedCount: 0,
      activeCount: 0,
      expiringCount: 0,
      emailedUserCount: 0,
      deliveries: []
    };
  }

  const expiringUserIds = expiringGroups.map((group) => group.user.id);
  const activeInvestments = await query(
    `
      select
        investments.id,
        investments.project,
        investments.asset_name as "assetName",
        investments.type,
        investments.amount,
        investments.currency,
        investments.apr_expected as "aprExpected",
        investments.end_time as "endTime",
        investments.remark,
        json_build_object(
          'id', users.id,
          'email', users.email,
          'name', users.name,
          'timezone', users.timezone
        ) as "user"
      from investments
      join users on users.id = investments.user_id
      where investments.is_deleted = false
        and investments.status = 'ONGOING'
        and users.status = 'ACTIVE'
        and users.id = any($1::int[])
      order by investments.id asc
    `,
    [expiringUserIds]
  );

  const groups = groupInvestmentsByUser(activeInvestments);
  const deliveries = [];
  let expiringCount = expiringCandidates.length;

  for (const group of groups) {
    const {
      expiringInvestments
    } = splitInvestmentsByExpiryWindow(group.investments, now, windowEnd);

    const subject = `投资到期提醒：${group.investments.length} 笔活跃投资，${expiringInvestments.length} 笔将在 24 小时内到期`;
    const payload = {
      user: group.user,
      investments: group.investments,
      windowEnd,
      referenceDate: now
    };
    const result = await sendEmail({
      to: group.user.email,
      subject,
      html: buildEmailHtml(payload),
      text: buildEmailText(payload)
    });

    deliveries.push({
      userId: group.user.id,
      email: group.user.email,
      investmentCount: group.investments.length,
      expiringCount: expiringInvestments.length,
      messageId: result?.id ?? null
    });
  }

  return {
    checkedCount: expiringCandidates.length,
    activeCount: activeInvestments.length,
    expiringCount,
    emailedUserCount: deliveries.length,
    deliveries
  };
}
