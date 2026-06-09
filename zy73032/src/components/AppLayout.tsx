import {
  LayoutDashboard,
  Upload,
  CalendarCheck,
  AlertTriangle,
  ScrollText,
  PawPrint,
  RotateCcw,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useReconcileStore } from "@/store/useReconcileStore";

const NAV = [
  { to: "/", label: "对账总览", icon: LayoutDashboard },
  { to: "/import", label: "导入中心", icon: Upload },
  { to: "/schedules", label: "排程明细", icon: CalendarCheck },
  { to: "/anomalies", label: "异常追踪", icon: AlertTriangle },
  { to: "/logs", label: "操作日志", icon: ScrollText },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const { currentOperator, setOperator, resetAll, getStats, getAliasConflicts } =
    useReconcileStore();
  const stats = getStats();
  const conflictCount = getAliasConflicts().length;
  const [operatorDraft, setOperatorDraft] = useState(currentOperator);
  const [editingOp, setEditingOp] = useState(false);

  const onConfirmOperator = () => {
    setOperator(operatorDraft.trim());
    setEditingOp(false);
  };

  return (
    <div className="min-h-screen flex bg-warm-50">
      <aside className="w-60 shrink-0 bg-white border-r border-warm-200 flex flex-col">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-warm-100">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
            <PawPrint className="w-5 h-5" />
          </div>
          <div>
            <div className="text-warm-800 font-serif text-lg font-semibold leading-tight">
              排程对账
            </div>
            <div className="text-[11px] text-warm-500">救助站 · 训练课</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link-active" : "nav-link"
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/anomalies" && conflictCount > 0 && (
                <span className="tag-anomaly">{conflictCount}</span>
              )}
              {item.to === "/schedules" && stats.pendingCount > 0 && (
                <span className="tag-pending">{stats.pendingCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-warm-100 space-y-2">
          <div className="rounded-xl bg-warm-50 border border-warm-200 p-3 text-xs text-warm-500">
            <div className="flex items-center justify-between mb-1">
              <span className="text-warm-700 font-medium">当前操作人</span>
              {editingOp ? (
                <button
                  onClick={onConfirmOperator}
                  className="text-brand-700 hover:text-brand-800 text-[11px]"
                >
                  确定
                </button>
              ) : (
                <button
                  onClick={() => setEditingOp(true)}
                  className="text-warm-500 hover:text-warm-700 text-[11px]"
                >
                  切换
                </button>
              )}
            </div>
            {editingOp ? (
              <input
                className="w-full rounded-md border border-warm-200 px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
                value={operatorDraft}
                onChange={(e) => setOperatorDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onConfirmOperator()}
              />
            ) : (
              <div className="text-sm text-warm-800 font-medium">
                {currentOperator}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (confirm("确定要重置为初始演示数据吗？所有改动会丢失。")) {
                resetAll();
                navigate("/");
              }
            }}
            className="btn-ghost w-full justify-start text-warm-500 hover:text-danger-600 hover:bg-danger-50 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置为演示数据
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-warm-200 px-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="font-serif text-xl text-warm-800 font-semibold">
              宠物训练课排程对账
            </h1>
            <p className="text-xs text-warm-500">
              把病历手写单、CSV明细和宠物别名的关系留下来
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-warm-500">
            <span>
              共 <b className="text-warm-800">{stats.totalSchedules}</b> 条排程
            </span>
            <span className="w-px h-4 bg-warm-200" />
            <span>
              <b className="text-success-700">{stats.confirmedCount}</b> 已确认
            </span>
            <span>
              <b className="text-brand-700">{stats.pendingCount}</b> 待确认
            </span>
            {stats.anomalyCount > 0 && (
              <span className="text-danger-700">
                ⚠ <b>{stats.anomalyCount}</b> 异常
              </span>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin">
          <div className="container py-6 animate-fadeUp">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
