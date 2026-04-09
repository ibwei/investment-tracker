"use client";

import { useDeferredValue, useState, useTransition } from "react";

const DELETE_CONFIRMATION = "DELETE";

const BASE_FORM = {
  project: "",
  assetName: "",
  url: "",
  type: "CeDeFi",
  amount: "",
  currency: "USD",
  allocationNote: "",
  startTime: "",
  endTime: "",
  aprExpected: "",
  aprActual: "",
  incomeTotal: "",
  incomeDaily: "",
  incomeWeekly: "",
  incomeMonthly: "",
  incomeYearly: "",
  status: "ONGOING",
  remark: ""
};

function createEmptyForm() {
  return { ...BASE_FORM };
}

function toTextValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function recordToForm(record) {
  return {
    project: toTextValue(record.project),
    assetName: toTextValue(record.assetName),
    url: toTextValue(record.url),
    type: toTextValue(record.type || "CeDeFi"),
    amount: toTextValue(record.amount),
    currency: toTextValue(record.currency || "USD"),
    allocationNote: toTextValue(record.allocationNote),
    startTime: toTextValue(record.startTime),
    endTime: toTextValue(record.endTime),
    aprExpected: toTextValue(record.aprExpected),
    aprActual: toTextValue(record.aprActual),
    incomeTotal: toTextValue(record.incomeTotal),
    incomeDaily: toTextValue(record.incomeDaily),
    incomeWeekly: toTextValue(record.incomeWeekly),
    incomeMonthly: toTextValue(record.incomeMonthly),
    incomeYearly: toTextValue(record.incomeYearly),
    status: toTextValue(record.status || "ONGOING"),
    remark: toTextValue(record.remark)
  };
}

function finishFormForRecord(record) {
  return {
    status: record.status === "ONGOING" ? "EARLY_ENDED" : "ENDED",
    endTime: record.endTime || new Date().toISOString().slice(0, 10),
    aprActual: record.aprActual ?? record.metrics.actualApr,
    incomeTotal: record.incomeTotal ?? record.metrics.totalIncome,
    remark: record.remark ?? ""
  };
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

function formatCurrency(value, currency = "USD") {
  const numeric = Number(value || 0);

  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(2)}%`;
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function buildSummary(records) {
  const activeRecords = records.filter((record) => record.status === "ONGOING");
  const historicalRecords = records.filter((record) => record.status !== "ONGOING");

  const deployedCapital = activeRecords.reduce(
    (total, record) => total + record.metrics.amount,
    0
  );
  const totalIncome = records.reduce(
    (total, record) => total + record.metrics.totalIncome,
    0
  );
  const activeDailyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.dailyIncome,
    0
  );
  const activeWeeklyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.weeklyIncome,
    0
  );
  const activeMonthlyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.monthlyIncome,
    0
  );
  const activeYearlyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.yearlyIncome,
    0
  );

  const weightedBase = activeRecords.reduce(
    (total, record) => total + record.metrics.amount,
    0
  );

  const weightedActualApr =
    weightedBase > 0
      ? activeRecords.reduce(
          (total, record) =>
            total + record.metrics.actualApr * record.metrics.amount,
          0
        ) / weightedBase
      : 0;

  return {
    activeCount: activeRecords.length,
    historicalCount: historicalRecords.length,
    deployedCapital,
    totalIncome,
    activeDailyIncome,
    activeWeeklyIncome,
    activeMonthlyIncome,
    activeYearlyIncome,
    weightedActualApr
  };
}

function matchesRecord(record, query, typeFilter, statusFilter) {
  const queryText = query.trim().toLowerCase();

  if (typeFilter !== "ALL" && record.type !== typeFilter) {
    return false;
  }

  if (statusFilter !== "ALL" && record.status !== statusFilter) {
    return false;
  }

  if (!queryText) {
    return true;
  }

  const haystack = [
    record.project,
    record.assetName,
    record.type,
    record.currency,
    record.remark,
    record.allocationNote
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(queryText);
}

function getSortableValue(record, key) {
  switch (key) {
    case "project":
      return `${record.project} ${record.assetName}`.toLowerCase();
    case "type":
      return record.type.toLowerCase();
    case "amount":
      return record.metrics.amount;
    case "expectedApr":
      return record.metrics.expectedApr;
    case "actualApr":
      return record.metrics.actualApr;
    case "dailyIncome":
      return record.metrics.dailyIncome;
    case "weeklyIncome":
      return record.metrics.weeklyIncome;
    case "monthlyIncome":
      return record.metrics.monthlyIncome;
    case "yearlyIncome":
      return record.metrics.yearlyIncome;
    case "totalIncome":
      return record.metrics.totalIncome;
    case "holdingDays":
      return record.metrics.holdingDays;
    case "endTime":
      return parseDateValue(record.endTime)?.getTime() || 0;
    case "startTime":
    default:
      return parseDateValue(record.startTime)?.getTime() || 0;
  }
}

function sortRecords(records, sortConfig) {
  return [...records].sort((left, right) => {
    const leftValue = getSortableValue(left, sortConfig.key);
    const rightValue = getSortableValue(right, sortConfig.key);

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      const comparison = String(leftValue).localeCompare(String(rightValue), "zh-CN");
      return sortConfig.direction === "asc" ? comparison : comparison * -1;
    }

    const comparison = Number(leftValue) - Number(rightValue);
    return sortConfig.direction === "asc" ? comparison : comparison * -1;
  });
}

function recordWithinRange(record, from, to) {
  if (!from && !to) {
    return true;
  }

  const anchor = parseDateValue(record.endTime || record.startTime);
  if (!anchor) {
    return false;
  }

  const fromDate = parseDateValue(from);
  const toDate = parseDateValue(to);

  if (fromDate && anchor < fromDate) {
    return false;
  }

  if (toDate && anchor > toDate) {
    return false;
  }

  return true;
}

function buildCurvePoints(records, historicalOnly = false) {
  const buckets = new Map();

  records
    .filter((record) => !historicalOnly || record.status !== "ONGOING")
    .forEach((record) => {
      const anchor = parseDateValue(record.endTime || record.startTime);
      if (!anchor) {
        return;
      }

      const key = [
        anchor.getFullYear(),
        String(anchor.getMonth() + 1).padStart(2, "0")
      ].join("-");

      buckets.set(key, (buckets.get(key) ?? 0) + record.metrics.totalIncome);
    });

  let cumulative = 0;

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, value]) => {
      cumulative += value;
      return {
        label: bucket.replace("-", " / "),
        value: cumulative
      };
    });
}

function buildProjectDistribution(records) {
  const buckets = new Map();

  records.forEach((record) => {
    const current = buckets.get(record.project) ?? {
      project: record.project,
      amount: 0,
      totalIncome: 0,
      weightedApr: 0
    };

    current.amount += record.metrics.amount;
    current.totalIncome += record.metrics.totalIncome;
    current.weightedApr += record.metrics.actualApr * record.metrics.amount;

    buckets.set(record.project, current);
  });

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      actualApr: bucket.amount > 0 ? bucket.weightedApr / bucket.amount : 0
    }))
    .sort((left, right) => right.totalIncome - left.totalIncome);
}

function buildAprOverview(records) {
  const activeRecords = records.filter((record) => record.status === "ONGOING");
  const expectedBase = activeRecords.reduce(
    (total, record) => total + record.metrics.amount,
    0
  );

  const expectedApr =
    expectedBase > 0
      ? activeRecords.reduce(
          (total, record) =>
            total + record.metrics.expectedApr * record.metrics.amount,
          0
        ) / expectedBase
      : 0;

  const actualApr =
    expectedBase > 0
      ? activeRecords.reduce(
          (total, record) =>
            total + record.metrics.actualApr * record.metrics.amount,
          0
        ) / expectedBase
      : 0;

  return {
    expectedApr,
    actualApr,
    delta: actualApr - expectedApr
  };
}

function StatCard({ label, value, helper }) {
  return (
    <article className="stat-card">
      <p className="mono-label">{label}</p>
      <h2>{value}</h2>
      <p>{helper}</p>
    </article>
  );
}

function SparklineCard({ title, description, points }) {
  const width = 480;
  const height = 220;
  const padding = 16;

  if (!points.length) {
    return (
      <article className="analytics-card">
        <div className="card-heading">
          <p className="mono-label">{title}</p>
          <h3>暂无曲线</h3>
          <p>{description}</p>
        </div>
        <div className="empty-chart">还没有足够数据生成曲线。</div>
      </article>
    );
  }

  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const valueSpan = maxValue - minValue || 1;
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const path = points
    .map((point, index) => {
      const x = padding + xStep * index;
      const y =
        height -
        padding -
        ((point.value - minValue) / valueSpan) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <article className="analytics-card">
      <div className="card-heading">
        <p className="mono-label">{title}</p>
        <h3>{formatCurrency(points.at(-1)?.value ?? 0)}</h3>
        <p>{description}</p>
      </div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <rect x="0" y="0" width={width} height={height} rx="24" />
        <path d={path} />
      </svg>
      <div className="chart-labels">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </article>
  );
}

function ProjectDistribution({ records }) {
  const rows = buildProjectDistribution(records);
  const maxIncome = Math.max(...rows.map((row) => row.totalIncome), 1);

  return (
    <article className="analytics-card">
      <div className="card-heading">
        <p className="mono-label">APR Analysis</p>
        <h3>项目分布</h3>
        <p>按项目观察投入规模、累计收益与实际 APR。</p>
      </div>
      {rows.length ? (
        <div className="distribution-list">
          {rows.map((row) => (
            <div key={row.project} className="distribution-row">
              <div className="distribution-topline">
                <strong>{row.project}</strong>
                <span>{formatCurrency(row.totalIncome)}</span>
              </div>
              <div className="distribution-bar">
                <span style={{ width: `${(row.totalIncome / maxIncome) * 100}%` }} />
              </div>
              <div className="distribution-meta">
                <span>{formatCurrency(row.amount)}</span>
                <span>{formatPercent(row.actualApr)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-chart">暂无可分析的项目分布。</div>
      )}
    </article>
  );
}

function InvestmentForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  statusOptions,
  typeOptions,
  title,
  compact = false
}) {
  return (
    <form className={`editor-panel ${compact ? "compact" : ""}`} onSubmit={onSubmit}>
      <div className="editor-heading">
        <div>
          <p className="mono-label">Editor</p>
          <h3>{title}</h3>
        </div>
        <div className="editor-actions">
          <button type="submit" className="primary-button">
            {submitLabel}
          </button>
          <button type="button" className="ghost-button" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>

      <div className="form-section">
        <p className="section-caption">基础信息</p>
        <div className="form-grid">
          <Field label="项目" required>
            <input
              value={value.project}
              onChange={(event) => onChange("project", event.target.value)}
              placeholder="Pendle / BounceBit"
            />
          </Field>
          <Field label="名称" required>
            <input
              value={value.assetName}
              onChange={(event) => onChange("assetName", event.target.value)}
              placeholder="USDF / USDAI"
            />
          </Field>
          <Field label="类型" required>
            <select
              value={value.type}
              onChange={(event) => onChange("type", event.target.value)}
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="币种">
            <input
              value={value.currency}
              onChange={(event) => onChange("currency", event.target.value.toUpperCase())}
              placeholder="USD / USDT"
            />
          </Field>
          <Field label="投入金额" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.amount}
              onChange={(event) => onChange("amount", event.target.value)}
              placeholder="10000"
            />
          </Field>
          <Field label="外链 URL">
            <input
              value={value.url}
              onChange={(event) => onChange("url", event.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="投入说明">
            <input
              value={value.allocationNote}
              onChange={(event) => onChange("allocationNote", event.target.value)}
              placeholder="PT / LP / Lending"
            />
          </Field>
          <Field label="状态">
            <select
              value={value.status}
              onChange={(event) => onChange("status", event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="form-section">
        <p className="section-caption">时间与收益</p>
        <div className="form-grid">
          <Field label="开始时间" required>
            <input
              type="date"
              value={value.startTime}
              onChange={(event) => onChange("startTime", event.target.value)}
            />
          </Field>
          <Field label="到期时间">
            <input
              type="date"
              value={value.endTime}
              onChange={(event) => onChange("endTime", event.target.value)}
            />
          </Field>
          <Field label="预期 APR (%)">
            <input
              type="number"
              step="0.01"
              value={value.aprExpected}
              onChange={(event) => onChange("aprExpected", event.target.value)}
              placeholder="18"
            />
          </Field>
          <Field label="实际 APR (%)">
            <input
              type="number"
              step="0.01"
              value={value.aprActual}
              onChange={(event) => onChange("aprActual", event.target.value)}
              placeholder="22"
            />
          </Field>
          <Field label="累计收益">
            <input
              type="number"
              step="0.01"
              value={value.incomeTotal}
              onChange={(event) => onChange("incomeTotal", event.target.value)}
              placeholder="留空则自动计算"
            />
          </Field>
          <Field label="日收益">
            <input
              type="number"
              step="0.01"
              value={value.incomeDaily}
              onChange={(event) => onChange("incomeDaily", event.target.value)}
            />
          </Field>
          <Field label="周收益">
            <input
              type="number"
              step="0.01"
              value={value.incomeWeekly}
              onChange={(event) => onChange("incomeWeekly", event.target.value)}
            />
          </Field>
          <Field label="月收益">
            <input
              type="number"
              step="0.01"
              value={value.incomeMonthly}
              onChange={(event) => onChange("incomeMonthly", event.target.value)}
            />
          </Field>
          <Field label="年收益">
            <input
              type="number"
              step="0.01"
              value={value.incomeYearly}
              onChange={(event) => onChange("incomeYearly", event.target.value)}
            />
          </Field>
          <Field label="备注" fullWidth>
            <textarea
              value={value.remark}
              onChange={(event) => onChange("remark", event.target.value)}
              placeholder="记录补充说明、风控提示或退出条件"
              rows={compact ? 3 : 4}
            />
          </Field>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children, required = false, fullWidth = false }) {
  return (
    <label className={`field ${fullWidth ? "field-wide" : ""}`}>
      <span className="field-label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function DashboardTable({
  title,
  description,
  records,
  emptyMessage,
  sortConfig,
  onSort,
  editingId,
  editingForm,
  onBeginEdit,
  onEditFieldChange,
  onEditSubmit,
  onEditCancel,
  onFinish,
  onDelete,
  statusOptions,
  typeOptions,
  historical = false
}) {
  const columns = [
    ["project", "项目 / 名称"],
    ["type", "类型"],
    ["amount", "投入"],
    ["startTime", "开始"],
    ["endTime", historical ? "结束" : "到期"],
    ["holdingDays", "持有天数"],
    ["expectedApr", "预期 APR"],
    ["actualApr", "实际 APR"],
    ["dailyIncome", "日收益"],
    ["weeklyIncome", "周收益"],
    ["monthlyIncome", "月收益"],
    ["yearlyIncome", "年收益"],
    ["totalIncome", "累计收益"]
  ];

  return (
    <section className="table-panel">
      <div className="panel-heading">
        <div>
          <p className="mono-label">{historical ? "History" : "Active"}</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="pill-badge">{records.length} 条</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}>
                  <button
                    type="button"
                    className="sort-button"
                    onClick={() => onSort(key)}
                  >
                    {label}
                    {sortConfig.key === key ? (
                      <span>{sortConfig.direction === "asc" ? " ↑" : " ↓"}</span>
                    ) : null}
                  </button>
                </th>
              ))}
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length ? (
              records.map((record) => (
                <FragmentRow key={record.id}>
                  <tr>
                    <td>
                      <div className="project-cell">
                        <strong>{record.project}</strong>
                        <span>{record.assetName}</span>
                        {record.url ? (
                          <a href={record.url} target="_blank" rel="noreferrer">
                            打开外链
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="pill-badge muted">{record.type}</span>
                      <div className="status-inline">{record.statusLabel}</div>
                    </td>
                    <td>{formatCurrency(record.metrics.amount, record.currency)}</td>
                    <td>{formatDate(record.startTime)}</td>
                    <td>{formatDate(record.endTime)}</td>
                    <td>{record.metrics.holdingDays} 天</td>
                    <td>{formatPercent(record.metrics.expectedApr)}</td>
                    <td>{formatPercent(record.metrics.actualApr)}</td>
                    <td>{formatCurrency(record.metrics.dailyIncome, record.currency)}</td>
                    <td>{formatCurrency(record.metrics.weeklyIncome, record.currency)}</td>
                    <td>{formatCurrency(record.metrics.monthlyIncome, record.currency)}</td>
                    <td>{formatCurrency(record.metrics.yearlyIncome, record.currency)}</td>
                    <td>{formatCurrency(record.metrics.totalIncome, record.currency)}</td>
                    <td className="remark-cell">{record.remark || "—"}</td>
                    <td>
                      <div className="action-cluster">
                        <button type="button" className="ghost-button small" onClick={() => onBeginEdit(record)}>
                          编辑
                        </button>
                        {!historical ? (
                          <button type="button" className="ghost-button small" onClick={() => onFinish(record)}>
                            提前结束
                          </button>
                        ) : null}
                        <button type="button" className="danger-button small" onClick={() => onDelete(record)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === record.id ? (
                    <tr className="editor-row">
                      <td colSpan={15}>
                        <InvestmentForm
                          compact
                          title={`内联编辑 · ${record.project}`}
                          value={editingForm}
                          onChange={onEditFieldChange}
                          onSubmit={onEditSubmit}
                          onCancel={onEditCancel}
                          submitLabel="保存修改"
                          statusOptions={statusOptions}
                          typeOptions={typeOptions}
                        />
                      </td>
                    </tr>
                  ) : null}
                </FragmentRow>
              ))
            ) : (
              <tr>
                <td colSpan={15} className="empty-row">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

export default function Dashboard({ initialSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState({
    key: "startTime",
    direction: "desc"
  });
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(initialSnapshot.records.length === 0);
  const [createForm, setCreateForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(createEmptyForm());
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [finishDialog, setFinishDialog] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const deferredQuery = useDeferredValue(query);

  const statusOptions = snapshot.meta.investmentStatuses;
  const typeOptions = snapshot.meta.investmentTypes;

  const filteredActiveRecords = sortRecords(
    snapshot.activeRecords.filter((record) =>
      matchesRecord(record, deferredQuery, typeFilter, statusFilter)
    ),
    sortConfig
  );

  const filteredHistoricalRecords = sortRecords(
    snapshot.historicalRecords.filter((record) =>
      matchesRecord(record, deferredQuery, typeFilter, statusFilter)
    ),
    sortConfig
  );

  const analyticsRecords = snapshot.records.filter((record) =>
    recordWithinRange(record, rangeFrom, rangeTo)
  );

  const analyticsSummary = buildSummary(analyticsRecords);
  const aprOverview = buildAprOverview(analyticsRecords);
  const totalCurve = buildCurvePoints(analyticsRecords, false);
  const historicalCurve = buildCurvePoints(analyticsRecords, true);

  function updateCreateField(name, nextValue) {
    setCreateForm((current) => ({
      ...current,
      [name]: nextValue
    }));
  }

  function updateEditField(name, nextValue) {
    setEditingForm((current) => ({
      ...current,
      [name]: nextValue
    }));
  }

  function cycleSort(key) {
    setSortConfig((current) => {
      if (current.key !== key) {
        return { key, direction: "desc" };
      }

      return {
        key,
        direction: current.direction === "desc" ? "asc" : "desc"
      };
    });
  }

  async function submitJson(url, options, successMessage) {
    setErrorMessage("");
    setMessage("");

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {})
      }
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "操作失败。");
    }

    if (payload.snapshot) {
      startTransition(() => {
        setSnapshot(payload.snapshot);
      });
    }

    setMessage(successMessage);
    return payload;
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();

    try {
      await submitJson(
        "/api/investments",
        {
          method: "POST",
          body: JSON.stringify(createForm)
        },
        "新增投资已写入工作台。"
      );

      setCreateForm(createEmptyForm());
      setCreateOpen(false);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    try {
      await submitJson(
        `/api/investments/${editingId}`,
        {
          method: "PATCH",
          body: JSON.stringify(editingForm)
        },
        "记录已更新。"
      );

      setEditingId(null);
      setEditingForm(createEmptyForm());
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function beginEdit(record) {
    setEditingId(record.id);
    setEditingForm(recordToForm(record));
    setCreateOpen(false);
    setMessage("");
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingForm(createEmptyForm());
  }

  async function handleFinishSubmit(event) {
    event.preventDefault();

    try {
      await submitJson(
        `/api/investments/${finishDialog.record.id}/finish`,
        {
          method: "POST",
          body: JSON.stringify(finishDialog.form)
        },
        "投资状态已更新为结束。"
      );

      setFinishDialog(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleDeleteSubmit(event) {
    event.preventDefault();

    try {
      await submitJson(
        `/api/investments/${deleteDialog.record.id}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            confirmationText: deleteDialog.confirmationText
          })
        },
        "记录已软删除。"
      );

      setDeleteDialog(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  return (
    <main className="dashboard-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="mono-label">CeFi · DeFi Investment Ops</p>
          <h1>Earn Compass</h1>
          <p>
            基于 PRD 构建的投资管理工作台，聚焦扁平化记录、收益自动计算、
            生命周期管理与多维分析。
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setCreateOpen((current) => !current);
              setEditingId(null);
            }}
          >
            {isCreateOpen ? "收起表单" : "新增投资"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setRangeFrom("");
              setRangeTo("");
            }}
          >
            重置分析范围
          </button>
        </div>
      </section>

      {message ? <p className="inline-message success">{message}</p> : null}
      {errorMessage ? <p className="inline-message error">{errorMessage}</p> : null}

      <section className="summary-grid">
        <StatCard
          label="Active Capital"
          value={formatCurrency(snapshot.summary.deployedCapital)}
          helper={`${snapshot.summary.activeCount} 条进行中仓位`}
        />
        <StatCard
          label="Today Run-Rate"
          value={formatCurrency(snapshot.summary.activeDailyIncome)}
          helper={`周收益 ${formatCurrency(snapshot.summary.activeWeeklyIncome)}`}
        />
        <StatCard
          label="Monthly Yield"
          value={formatCurrency(snapshot.summary.activeMonthlyIncome)}
          helper={`年化估算 ${formatCurrency(snapshot.summary.activeYearlyIncome)}`}
        />
        <StatCard
          label="Weighted APR"
          value={formatPercent(snapshot.summary.weightedActualApr)}
          helper={`${snapshot.summary.historicalCount} 条历史记录`}
        />
      </section>

      <section className="toolbar-panel">
        <div className="toolbar-cluster">
          <Field label="搜索">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="项目、名称、类型、备注"
            />
          </Field>
          <Field label="类型">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="ALL">全部类型</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="状态">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">全部状态</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="toolbar-cluster">
          <Field label="分析开始">
            <input
              type="date"
              value={rangeFrom}
              onChange={(event) => setRangeFrom(event.target.value)}
            />
          </Field>
          <Field label="分析结束">
            <input
              type="date"
              value={rangeTo}
              onChange={(event) => setRangeTo(event.target.value)}
            />
          </Field>
        </div>
      </section>

      {isCreateOpen ? (
        <InvestmentForm
          title="新增投资记录"
          value={createForm}
          onChange={updateCreateField}
          onSubmit={handleCreateSubmit}
          onCancel={() => {
            setCreateOpen(false);
            setCreateForm(createEmptyForm());
          }}
          submitLabel="保存记录"
          statusOptions={statusOptions}
          typeOptions={typeOptions}
        />
      ) : null}

      <DashboardTable
        title="投资面板"
        description="覆盖项目、类型、APR、日 / 周 / 月 / 年收益、累计收益与生命周期动作。"
        records={filteredActiveRecords}
        emptyMessage="当前没有匹配条件的进行中投资。"
        sortConfig={sortConfig}
        onSort={cycleSort}
        editingId={editingId}
        editingForm={editingForm}
        onBeginEdit={beginEdit}
        onEditFieldChange={updateEditField}
        onEditSubmit={handleEditSubmit}
        onEditCancel={cancelEdit}
        onFinish={(record) =>
          setFinishDialog({
            record,
            form: finishFormForRecord(record)
          })
        }
        onDelete={(record) =>
          setDeleteDialog({
            record,
            confirmationText: ""
          })
        }
        statusOptions={statusOptions}
        typeOptions={typeOptions}
      />

      <DashboardTable
        historical
        title="历史收益"
        description="展示已结束与提前结束仓位的实际 APR、实际收益与删除操作。"
        records={filteredHistoricalRecords}
        emptyMessage="当前还没有历史仓位。"
        sortConfig={sortConfig}
        onSort={cycleSort}
        editingId={editingId}
        editingForm={editingForm}
        onBeginEdit={beginEdit}
        onEditFieldChange={updateEditField}
        onEditSubmit={handleEditSubmit}
        onEditCancel={cancelEdit}
        onFinish={() => {}}
        onDelete={(record) =>
          setDeleteDialog({
            record,
            confirmationText: ""
          })
        }
        statusOptions={statusOptions}
        typeOptions={typeOptions}
      />

      <section className="analytics-layout">
        <article className="analytics-card compact-stats">
          <div className="card-heading">
            <p className="mono-label">Analytics</p>
            <h3>收益统计</h3>
            <p>
              当前分析范围内共 {analyticsRecords.length} 条记录，
              累计收益 {formatCurrency(analyticsSummary.totalIncome)}。
            </p>
          </div>
          <div className="compact-grid">
            <div>
              <span>日收益</span>
              <strong>{formatCurrency(analyticsSummary.activeDailyIncome)}</strong>
            </div>
            <div>
              <span>周收益</span>
              <strong>{formatCurrency(analyticsSummary.activeWeeklyIncome)}</strong>
            </div>
            <div>
              <span>月收益</span>
              <strong>{formatCurrency(analyticsSummary.activeMonthlyIncome)}</strong>
            </div>
            <div>
              <span>年收益</span>
              <strong>{formatCurrency(analyticsSummary.activeYearlyIncome)}</strong>
            </div>
          </div>
        </article>

        <article className="analytics-card compact-stats">
          <div className="card-heading">
            <p className="mono-label">APR Review</p>
            <h3>实际 vs 预期</h3>
            <p>观察当前仓位的加权 APR 偏差。</p>
          </div>
          <div className="apr-compare">
            <div>
              <span>预期 APR</span>
              <strong>{formatPercent(aprOverview.expectedApr)}</strong>
            </div>
            <div>
              <span>实际 APR</span>
              <strong>{formatPercent(aprOverview.actualApr)}</strong>
            </div>
            <div>
              <span>偏差</span>
              <strong>{formatPercent(aprOverview.delta)}</strong>
            </div>
          </div>
        </article>

        <SparklineCard
          title="Income Curve"
          description="按月累计全部仓位收益，快速查看收益曲线。"
          points={totalCurve}
        />

        <SparklineCard
          title="Closed Curve"
          description="仅统计历史仓位累计收益，评估退出结果。"
          points={historicalCurve}
        />

        <ProjectDistribution records={analyticsRecords} />

        <article className="analytics-card">
          <div className="card-heading">
            <p className="mono-label">Signals</p>
            <h3>数据快照</h3>
            <p>从当前分析范围中快速判断头部项目与收益体量。</p>
          </div>
          <div className="signal-list">
            {analyticsRecords.slice(0, 5).map((record) => (
              <div key={record.id} className="signal-row">
                <div>
                  <strong>{record.project}</strong>
                  <span>{record.assetName}</span>
                </div>
                <div>
                  <strong>{formatCurrency(record.metrics.totalIncome, record.currency)}</strong>
                  <span>{formatPercent(record.metrics.actualApr)}</span>
                </div>
              </div>
            ))}
            {!analyticsRecords.length ? (
              <div className="empty-chart">请先录入投资记录，再查看分析信号。</div>
            ) : null}
          </div>
        </article>
      </section>

      {finishDialog ? (
        <dialog open className="modal-shell">
          <form className="modal-card" onSubmit={handleFinishSubmit}>
            <div className="card-heading">
              <p className="mono-label">Finish Position</p>
              <h3>结束投资</h3>
              <p>
                {finishDialog.record.project} ·{" "}
                {formatCurrency(
                  finishDialog.record.metrics.amount,
                  finishDialog.record.currency
                )}
              </p>
            </div>
            <div className="form-grid">
              <Field label="结束状态">
                <select
                  value={finishDialog.form.status}
                  onChange={(event) =>
                    setFinishDialog((current) => ({
                      ...current,
                      form: {
                        ...current.form,
                        status: event.target.value
                      }
                    }))
                  }
                >
                  <option value="ENDED">已结束</option>
                  <option value="EARLY_ENDED">提前结束</option>
                </select>
              </Field>
              <Field label="结束时间">
                <input
                  type="date"
                  value={finishDialog.form.endTime}
                  onChange={(event) =>
                    setFinishDialog((current) => ({
                      ...current,
                      form: {
                        ...current.form,
                        endTime: event.target.value
                      }
                    }))
                  }
                />
              </Field>
              <Field label="最终累计收益">
                <input
                  type="number"
                  step="0.01"
                  value={finishDialog.form.incomeTotal}
                  onChange={(event) =>
                    setFinishDialog((current) => ({
                      ...current,
                      form: {
                        ...current.form,
                        incomeTotal: event.target.value
                      }
                    }))
                  }
                />
              </Field>
              <Field label="实际 APR (%)">
                <input
                  type="number"
                  step="0.01"
                  value={finishDialog.form.aprActual}
                  onChange={(event) =>
                    setFinishDialog((current) => ({
                      ...current,
                      form: {
                        ...current.form,
                        aprActual: event.target.value
                      }
                    }))
                  }
                />
              </Field>
              <Field label="备注" fullWidth>
                <textarea
                  rows={4}
                  value={finishDialog.form.remark}
                  onChange={(event) =>
                    setFinishDialog((current) => ({
                      ...current,
                      form: {
                        ...current.form,
                        remark: event.target.value
                      }
                    }))
                  }
                />
              </Field>
            </div>
            <div className="modal-actions">
              <button type="submit" className="primary-button">
                确认结束
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setFinishDialog(null)}
              >
                取消
              </button>
            </div>
          </form>
        </dialog>
      ) : null}

      {deleteDialog ? (
        <dialog open className="modal-shell">
          <form className="modal-card" onSubmit={handleDeleteSubmit}>
            <div className="card-heading">
              <p className="mono-label">Delete Safeguard</p>
              <h3>确认删除</h3>
              <p>
                即将软删除 {deleteDialog.record.project} ·{" "}
                {formatCurrency(
                  deleteDialog.record.metrics.amount,
                  deleteDialog.record.currency
                )}
                。请输入 <strong>{DELETE_CONFIRMATION}</strong> 继续。
              </p>
            </div>
            <Field label="确认口令">
              <input
                value={deleteDialog.confirmationText}
                onChange={(event) =>
                  setDeleteDialog((current) => ({
                    ...current,
                    confirmationText: event.target.value
                  }))
                }
                placeholder={DELETE_CONFIRMATION}
              />
            </Field>
            <div className="modal-actions">
              <button type="submit" className="danger-button">
                删除记录
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDeleteDialog(null)}
              >
                取消
              </button>
            </div>
          </form>
        </dialog>
      ) : null}

      {isPending ? <div className="floating-hint">正在同步数据…</div> : null}
    </main>
  );
}
