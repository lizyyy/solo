import { useGateStore } from "@/store/useGateStore";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  ClipboardCheck,
  BarChart3,
  History,
  AlertTriangle,
  CheckCircle,
  Clock,
  RotateCcw,
} from "lucide-react";

export default function Home() {
  const records = useGateStore((s) => s.records);
  const auditLogs = useGateStore((s) => s.auditLogs);
  const navigate = useNavigate();

  const statusCounts = {
    pending_review: records.filter((r) => r.status === "pending_review").length,
    confirmed_normal: records.filter((r) => r.status === "confirmed_normal").length,
    confirmed_anomaly: records.filter((r) => r.status === "confirmed_anomaly").length,
    pending_field_review: records.filter((r) => r.status === "pending_field_review").length,
    corrected: records.filter((r) => r.status === "corrected").length,
    rolled_back: records.filter((r) => r.status === "rolled_back").length,
  };

  const zAxisAnomalyCount = records.filter(
    (r) => r.zAxisDirection === "negative"
  ).length;

  const quickActions = [
    {
      label: "安全半径表导入",
      desc: "上传安全半径表，系统自动解析并检测Z轴方向",
      icon: Upload,
      path: "/import",
      color: "var(--color-steel)",
    },
    {
      label: "坐标原点说明审核",
      desc: "培训教官逐条审核，标记异常交现场复核",
      icon: ClipboardCheck,
      path: "/review",
      color: "var(--color-warning)",
    },
    {
      label: "闸门开度展示",
      desc: "汇总展示开度数据，支持路径回放与导出",
      icon: BarChart3,
      path: "/display",
      color: "var(--color-success)",
    },
    {
      label: "审计追踪",
      desc: "查看变更日志，支持回滚与状态筛选",
      icon: History,
      path: "/audit",
      color: "#8B5CF6",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          系统概览
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          水库闸门开度展示 — 安全半径表管理
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "待复核",
            count: statusCounts.pending_review,
            icon: Clock,
            color: "#F59E0B",
            bg: "#FEF3C7",
          },
          {
            label: "Z轴异常",
            count: zAxisAnomalyCount,
            icon: AlertTriangle,
            color: "#EF4444",
            bg: "#FEE2E2",
          },
          {
            label: "已确认正常",
            count: statusCounts.confirmed_normal,
            icon: CheckCircle,
            color: "#10B981",
            bg: "#D1FAE5",
          },
          {
            label: "已回滚",
            count: statusCounts.rolled_back,
            icon: RotateCcw,
            color: "#6B7280",
            bg: "#E5E7EB",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                {stat.label}
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: stat.color }}>
              {stat.count}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {quickActions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="rounded-xl p-6 border text-left transition-all duration-200 group"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = action.color;
              e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.backgroundColor = "var(--color-surface)";
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <action.icon size={22} style={{ color: action.color }} />
              <span className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                {action.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {action.desc}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-6"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: "var(--color-text)" }}>
          数据统计
        </h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold" style={{ color: "var(--color-steel)" }}>
              {records.length}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              总记录数
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "var(--color-steel)" }}>
              {auditLogs.length}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              审计日志数
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "var(--color-steel)" }}>
              {statusCounts.pending_field_review + statusCounts.confirmed_anomaly}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              需处理异常
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
