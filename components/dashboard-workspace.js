"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Layout,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined
} from "@ant-design/icons";
import NavigationShell from "@/components/navigation-shell";
import { useInvestmentWorkspace } from "@/hooks/use-investment-workspace";
import { STORAGE_MODES } from "@/lib/storage-mode";

const { Paragraph, Text } = Typography;

const baseValues = {
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

function toFormValues(record) {
  return {
    ...baseValues,
    ...record,
    amount: record.amount ?? "",
    aprExpected: record.aprExpected ?? "",
    aprActual: record.aprActual ?? "",
    incomeTotal: record.incomeTotal ?? "",
    incomeDaily: record.incomeDaily ?? "",
    incomeWeekly: record.incomeWeekly ?? "",
    incomeMonthly: record.incomeMonthly ?? "",
    incomeYearly: record.incomeYearly ?? ""
  };
}

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

export default function DashboardWorkspace({ initialSnapshot }) {
  const {
    storageMode,
    snapshot,
    errorMessage,
    isPending,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    earlyCloseInvestment
  } = useInvestmentWorkspace(initialSnapshot);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [finishRecord, setFinishRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [form] = Form.useForm();
  const [finishForm] = Form.useForm();

  const filteredRecords = useMemo(() => {
    return snapshot.records.filter((record) => {
      const matchesQuery =
        !query ||
        [record.project, record.assetName, record.remark, record.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());

      const matchesType = typeFilter === "ALL" || record.type === typeFilter;
      const matchesStatus = statusFilter === "ALL" || record.status === statusFilter;

      return matchesQuery && matchesType && matchesStatus;
    });
  }, [query, snapshot.records, statusFilter, typeFilter]);

  const activeRecords = filteredRecords.filter((record) => record.status === "ONGOING");
  const historicalRecords = filteredRecords.filter((record) => record.status !== "ONGOING");

  async function submitForm() {
    const values = await form.validateFields();

    if (editingRecord) {
      await updateInvestment(editingRecord.id, values);
    } else {
      await createInvestment(values);
    }

    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }

  async function submitFinishForm() {
    const values = await finishForm.validateFields();
    await earlyCloseInvestment(finishRecord.id, values);
    setFinishRecord(null);
    finishForm.resetFields();
  }

  const columns = [
    {
      title: "项目",
      dataIndex: "project",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.project}</Text>
          <Text type="secondary">{record.assetName}</Text>
        </Space>
      )
    },
    {
      title: "类型",
      dataIndex: "type",
      render: (value, record) => (
        <Space direction="vertical" size={4}>
          <Tag>{value}</Tag>
          <Text type="secondary">{record.statusLabel}</Text>
        </Space>
      )
    },
    {
      title: "投入",
      dataIndex: "amount",
      sorter: (left, right) => left.metrics.amount - right.metrics.amount,
      render: (_, record) => formatCurrency(record.metrics.amount, record.currency)
    },
    {
      title: "预期 APR",
      dataIndex: "aprExpected",
      sorter: (left, right) => left.metrics.expectedApr - right.metrics.expectedApr,
      render: (_, record) => `${record.metrics.expectedApr.toFixed(2)}%`
    },
    {
      title: "实际 APR",
      dataIndex: "aprActual",
      sorter: (left, right) => left.metrics.actualApr - right.metrics.actualApr,
      render: (_, record) => `${record.metrics.actualApr.toFixed(2)}%`
    },
    {
      title: "日收益",
      dataIndex: "incomeDaily",
      sorter: (left, right) => left.metrics.dailyIncome - right.metrics.dailyIncome,
      render: (_, record) => formatCurrency(record.metrics.dailyIncome, record.currency)
    },
    {
      title: "累计收益",
      dataIndex: "incomeTotal",
      sorter: (left, right) => left.metrics.totalIncome - right.metrics.totalIncome,
      render: (_, record) => formatCurrency(record.metrics.totalIncome, record.currency)
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRecord(record);
              setModalOpen(true);
              form.setFieldsValue(toFormValues(record));
            }}
          >
            编辑
          </Button>
          {record.status === "ONGOING" ? (
            <Button
              icon={<StopOutlined />}
              onClick={() => {
                setFinishRecord(record);
                finishForm.setFieldsValue({
                  status: "EARLY_ENDED",
                  endTime: new Date().toISOString().slice(0, 10),
                  aprActual: record.aprActual ?? record.metrics.actualApr,
                  incomeTotal: record.incomeTotal ?? record.metrics.totalIncome,
                  remark: record.remark ?? ""
                });
              }}
            >
              提前结束
            </Button>
          ) : null}
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              setDeleteRecord(record);
              setConfirmationText("");
            }}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <NavigationShell title="Dashboard" description="主工作台">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type={storageMode === STORAGE_MODES.LOCAL ? "info" : "success"}
          showIcon
          message={`当前为${storageMode === STORAGE_MODES.LOCAL ? "本地模式" : "远程模式"}`}
          description={
            storageMode === STORAGE_MODES.LOCAL
              ? "数据保存在浏览器 IndexedDB，可直接体验完整 Dashboard；Analysis 会受限。"
              : "当前已切到远程模式，数据通过 API 走服务端存储链路。"
          }
        />

        {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={8}>
            <Card>
              <Statistic title="总投入" value={snapshot.summary.deployedCapital} precision={2} prefix="$" />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card>
              <Statistic title="当前累计收益" value={snapshot.summary.totalIncome} precision={2} prefix="$" />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card>
              <Statistic title="当前每日收益" value={snapshot.summary.activeDailyIncome} precision={2} prefix="$" />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card>
              <Statistic title="当前每周收益" value={snapshot.summary.activeWeeklyIncome} precision={2} prefix="$" />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card>
              <Statistic title="当前每月收益" value={snapshot.summary.activeMonthlyIncome} precision={2} prefix="$" />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={8}>
            <Card>
              <Statistic title="当前综合 APR" value={snapshot.summary.weightedActualApr} precision={2} suffix="%" />
            </Card>
          </Col>
        </Row>

        <Card>
          <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="搜索项目 / 名称 / 备注"
                style={{ width: 280 }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Select
                value={typeFilter}
                style={{ width: 180 }}
                onChange={setTypeFilter}
                options={[
                  { value: "ALL", label: "全部类型" },
                  ...snapshot.meta.investmentTypes.map((type) => ({
                    value: type,
                    label: type
                  }))
                ]}
              />
              <Select
                value={statusFilter}
                style={{ width: 180 }}
                onChange={setStatusFilter}
                options={[
                  { value: "ALL", label: "全部状态" },
                  ...snapshot.meta.investmentStatuses
                ]}
              />
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRecord(null);
                setModalOpen(true);
                form.setFieldsValue(baseValues);
              }}
            >
              新增投资
            </Button>
          </Space>
        </Card>

        <Card title="投资记录表格">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={activeRecords}
            pagination={{ pageSize: 6 }}
            scroll={{ x: 1200 }}
            loading={isPending}
          />
        </Card>

        <Card title="历史收益">
          <Table
            rowKey="id"
            columns={columns.filter((column) => column.key !== "actions").concat(columns.at(-1))}
            dataSource={historicalRecords}
            pagination={{ pageSize: 6 }}
            locale={{ emptyText: "暂无历史仓位" }}
            scroll={{ x: 1200 }}
            loading={isPending}
          />
        </Card>
      </Space>

      <Modal
        open={isModalOpen}
        title={editingRecord ? "编辑投资记录" : "新增投资记录"}
        onCancel={() => {
          setModalOpen(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        onOk={submitForm}
        width={860}
      >
        <Form form={form} layout="vertical" initialValues={baseValues}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="project" label="项目" rules={[{ required: true }]}>
                <Input placeholder="Pendle / BounceBit" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assetName" label="名称" rules={[{ required: true }]}>
                <Input placeholder="USDF / USDAI" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                <Select options={snapshot.meta.investmentTypes.map((item) => ({ value: item, label: item }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="币种">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="amount" label="投入金额" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="到期时间">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="aprExpected" label="预期 APR (%)">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="aprActual" label="实际 APR (%)">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="incomeTotal" label="累计收益">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="url" label="外链 URL">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="allocationNote" label="投入说明">
                <Input placeholder="PT / LP / Lending" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={Boolean(finishRecord)}
        title="提前结束投资"
        onCancel={() => {
          setFinishRecord(null);
          finishForm.resetFields();
        }}
        onOk={submitFinishForm}
      >
        <Form form={finishForm} layout="vertical">
          <Form.Item name="status" label="结束状态">
            <Select
              options={[
                { value: "ENDED", label: "已结束" },
                { value: "EARLY_ENDED", label: "提前结束" }
              ]}
            />
          </Form.Item>
          <Form.Item name="endTime" label="结束时间">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="incomeTotal" label="最终累计收益">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="aprActual" label="实际 APR (%)">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(deleteRecord)}
        title="删除确认"
        onCancel={() => {
          setDeleteRecord(null);
          setConfirmationText("");
        }}
        onOk={async () => {
          await deleteInvestment(deleteRecord.id, confirmationText);
          setDeleteRecord(null);
          setConfirmationText("");
        }}
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          即将删除 <Text strong>{deleteRecord?.project}</Text>，
          请输入 <Text code>DELETE</Text> 以确认。
        </Paragraph>
        <Input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} />
      </Modal>
    </NavigationShell>
  );
}
