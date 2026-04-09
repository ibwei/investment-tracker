"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChartOutlined,
  HomeOutlined,
  LoginOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { Layout, Menu, Space, Tag, Typography } from "antd";
import { getStorageModeLabel } from "@/lib/storage-mode";
import { useAppStore } from "@/store/app-store";

const { Header, Content, Sider } = Layout;
const { Paragraph, Title } = Typography;

const menuItems = [
  {
    key: "/dashboard",
    icon: <HomeOutlined />,
    label: <Link href="/dashboard">Dashboard</Link>
  },
  {
    key: "/analysis",
    icon: <BarChartOutlined />,
    label: <Link href="/analysis">Analysis</Link>
  },
  {
    key: "/settings",
    icon: <SettingOutlined />,
    label: <Link href="/settings">Settings</Link>
  },
  {
    key: "/login",
    icon: <LoginOutlined />,
    label: <Link href="/login">Login</Link>
  }
];

export default function NavigationShell({ title, description, children }) {
  const pathname = usePathname();
  const storageMode = useAppStore((state) => state.storageMode);

  return (
    <Layout className="app-shell">
      <Sider breakpoint="lg" collapsedWidth={0} width={256} theme="light">
        <div className="brand-block">
          <Paragraph className="eyebrow">CeFi · DeFi</Paragraph>
          <Title level={2}>Earn Compass</Title>
          <Paragraph type="secondary">
            双存储模式投资管理工作台
          </Paragraph>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          style={{ border: "none", background: "transparent" }}
        />
      </Sider>
      <Layout>
        <Header className="content-header">
          <div>
            <Paragraph className="eyebrow">{title}</Paragraph>
            <Title level={2} style={{ margin: 0 }}>
              {description}
            </Title>
          </div>
          <Space size="middle">
            <Tag bordered={false} color="default" className="mode-tag">
              {getStorageModeLabel(storageMode)}
            </Tag>
          </Space>
        </Header>
        <Content className="content-body">{children}</Content>
      </Layout>
    </Layout>
  );
}
