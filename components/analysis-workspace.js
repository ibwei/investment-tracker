"use client";

import { useMemo, useState } from "react";
import { Alert, Card, DatePicker, Empty, List, Space, Statistic, Typography } from "antd";
import dayjs from "dayjs";
import NavigationShell from "@/components/navigation-shell";
import { useInvestmentWorkspace } from "@/hooks/use-investment-workspace";
import { STORAGE_MODES } from "@/lib/storage-mode";

const { RangePicker } = DatePicker;
const { Paragraph } = Typography;

function formatCurrency(value, currency = "USD") {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

export default function AnalysisWorkspace({ initialSnapshot }) {
  const { storageMode, snapshot } = useInvestmentWorkspace(initialSnapshot);
  const [range, setRange] = useState(null);

  const historyRecords = useMemo(() => {
    return snapshot.historicalRecords.filter((record) => {
      if (!range?.length) {
        return true;
      }

      const anchor = dayjs(record.endTime || record.startTime);
      return anchor.isAfter(range[0].startOf("day")) && anchor.isBefore(range[1].endOf("day"));
    });
  }, [range, snapshot.historicalRecords]);

  const totalHistoryIncome = historyRecords.reduce(
    (total, record) => total + record.metrics.totalIncome,
    0
  );
  const averageApr =
    historyRecords.length > 0
      ? historyRecords.reduce((total, record) => total + record.metrics.actualApr, 0) /
        historyRecords.length
      : 0;

  return (
    <NavigationShell title="Analysis" description="分析页">
      {storageMode === STORAGE_MODES.LOCAL ? (
        <Card>
          <Empty
            description="本地模式不开放 Analysis 页面。请前往 Settings 切换为远程模式。"
          />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="success"
            showIcon
            message="远程模式分析视图"
            description="MVP 阶段先基于现有记录提供时间范围分析；后续将接入日快照表与专业时序图表。"
          />
          <Card>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Paragraph className="eyebrow">Time Range</Paragraph>
              <RangePicker value={range} onChange={(values) => setRange(values)} />
            </Space>
          </Card>
          <Space size={16} wrap style={{ width: "100%" }}>
            <Card style={{ minWidth: 240 }}>
              <Statistic title="历史累计收益" value={totalHistoryIncome} precision={2} prefix="$" />
            </Card>
            <Card style={{ minWidth: 240 }}>
              <Statistic title="平均实际 APR" value={averageApr} precision={2} suffix="%" />
            </Card>
            <Card style={{ minWidth: 240 }}>
              <Statistic title="结束仓位数" value={historyRecords.length} />
            </Card>
          </Space>
          <Card title="历史收益列表">
            <List
              dataSource={historyRecords}
              renderItem={(record) => (
                <List.Item>
                  <List.Item.Meta
                    title={`${record.project} · ${record.assetName}`}
                    description={`结束时间 ${record.endTime || record.startTime}`}
                  />
                  <Space size="large">
                    <span>{formatCurrency(record.metrics.totalIncome, record.currency)}</span>
                    <span>{record.metrics.actualApr.toFixed(2)}%</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Space>
      )}
    </NavigationShell>
  );
}
