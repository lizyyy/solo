import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "显微镜共享预约冲突器",
  description: "实验室显微镜预约管理系统，支持主设备与附件组合资源的同步占用检测",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
