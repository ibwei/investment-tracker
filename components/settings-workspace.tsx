"use client";

import Link from "next/link";
import { Alert, Button, Card, Descriptions, Segmented, Space, Typography } from "antd";
import NavigationShell from "@/components/navigation-shell";
import { STORAGE_MODES } from "@/lib/storage-mode";
import { useAppStore } from "@/store/app-store";

const { Paragraph } = Typography;

export default function SettingsWorkspace() {
  const storageMode = useAppStore((state) => state.storageMode);
  const setStorageMode = useAppStore((state) => state.setStorageMode);

  return (
    <NavigationShell title="Settings" description="个人中心 / 设置">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title="数据存储模式">
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Paragraph type="secondary">
              技术方案要求支持 Local Mode / Remote Mode 双存储。当前已接入浏览器 IndexedDB 本地模式，
              并保留远程模式 API 通路与后续 Prisma/Auth.js 扩展位。
            </Paragraph>
            <Segmented
              value={storageMode}
              onChange={setStorageMode}
              options={[
                { label: "Local Mode", value: STORAGE_MODES.LOCAL },
                { label: "Remote Mode", value: STORAGE_MODES.REMOTE }
              ]}
            />
            {storageMode === STORAGE_MODES.LOCAL ? (
              <Alert
                type="info"
                showIcon
                message="本地模式"
                description="数据保存在 IndexedDB，Dashboard 可用，Analysis 会限制。"
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message="远程模式"
                description="当前走服务端 API 链路；接通 Prisma + SQLite + Auth.js 后可启用完整多用户能力。"
              />
            )}
          </Space>
        </Card>

        <Card title="用户系统状态">
          <Descriptions column={1} bordered>
            <Descriptions.Item label="认证方案">Auth.js / NextAuth（已预留页面入口）</Descriptions.Item>
            <Descriptions.Item label="数据库方案">SQLite + Prisma（已切换为统一基线）</Descriptions.Item>
            <Descriptions.Item label="当前体验建议">
              先使用 <Link href="/dashboard">Dashboard</Link> 录入数据，再在此切换模式验证体验。
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="后续接入项">
          <Space direction="vertical" size={12}>
            <Link href="/login">
              <Button>前往登录页面</Button>
            </Link>
            <Paragraph type="secondary">
              下一步可直接接入 `AUTH_SECRET`、Auth.js 和用户表逻辑，完成远程模式正式落地。
            </Paragraph>
          </Space>
        </Card>
      </Space>
    </NavigationShell>
  );
}
