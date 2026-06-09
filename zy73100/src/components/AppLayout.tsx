import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Grid3x3,
  Filter,
  History,
  Droplets,
  Ruler,
  RotateCcw,
  ChevronDown,
  User,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useReviewStore } from "@/store/useReviewStore";

const OPERATORS = ["老叶", "张经理", "王工"];

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "项目经理总览", icon: LayoutDashboard },
  { to: "/material-review", label: "材料送审表", icon: FileSpreadsheet },
  { to: "/drawing-review", label: "图纸复核工作台", icon: Grid3x3 },
  { to: "/export-center", label: "筛选与导出中心", icon: Filter },
  { to: "/review-log", label: "复盘记录", icon: History },
];

const breadcrumbMap: Record<string, string[]> = {
  "/dashboard": ["首页", "项目经理总览"],
  "/material-review": ["首页", "材料送审表"],
  "/drawing-review": ["首页", "图纸复核工作台"],
  "/export-center": ["首页", "筛选与导出中心"],
  "/review-log": ["首页", "复盘记录"],
};

function getPageTitle(pathname: string): string {
  const item = navItems.find((n) => n.to === pathname);
  return item?.label ?? "未知页面";
}

export default function AppLayout() {
  const location = useLocation();
  const currentOperator = useReviewStore((s) => s.currentOperator);
  const setCurrentOperator = useReviewStore((s) => s.setCurrentOperator);
  const resetAll = useReviewStore((s) => s.resetAll);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const breadcrumbs = breadcrumbMap[location.pathname] ?? ["首页"];
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 左侧导航栏 */}
      <aside className="no-print flex w-60 flex-shrink-0 flex-col bg-gradient-to-b from-brand-900 to-brand-800 text-white">
        {/* Logo & 标题 */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Droplets className="h-5 w-5 text-brand-200" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-brand-300" />
              <span className="font-display text-[15px] font-semibold tracking-wide">
                屋面排水图纸复核
              </span>
            </div>
            <span className="mt-0.5 text-[11px] text-brand-300/80">
              Roof Drain Review System
            </span>
          </div>
        </div>

        {/* 导航项 */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "bg-brand-700/60 border-l-4 border-brand-400 pl-[10px]"
                          : "hover:bg-white/10 border-l-4 border-transparent pl-[10px]"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-90" />
                    <span className="flex-1 font-medium">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部操作区 */}
        <div className="border-t border-white/10 px-3 py-3 space-y-2">
          {/* 操作人选择 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOperatorOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/15 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 ring-1 ring-white/20">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[11px] text-brand-300/80">当前操作人</span>
                <span className="text-sm font-medium truncate">
                  {currentOperator}
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-brand-300 transition-transform ${
                  operatorOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {operatorOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-md border border-white/20 bg-brand-900 shadow-xl">
                {OPERATORS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => {
                      setCurrentOperator(op);
                      setOperatorOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      op === currentOperator
                        ? "bg-brand-700/60 text-white"
                        : "hover:bg-white/10 text-brand-100"
                    }`}
                  >
                    <User className="h-3.5 w-3.5 opacity-80" />
                    <span>{op}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 重置演示数据 */}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-red-600/80 hover:border-red-400 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>重置演示数据</span>
          </button>
        </div>
      </aside>

      {/* 右侧主区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center gap-3">
            <nav className="flex items-center text-xs text-slate-500">
              {breadcrumbs.map((bc, idx) => (
                <span key={idx} className="flex items-center">
                  {idx > 0 && <ChevronRight className="mx-1.5 h-3 w-3 text-slate-400" />}
                  <span
                    className={
                      idx === breadcrumbs.length - 1
                        ? "text-slate-800 font-medium"
                        : ""
                    }
                  >
                    {bc}
                  </span>
                </span>
              ))}
            </nav>
            <h1 className="ml-2 font-display text-xl font-semibold text-slate-800">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              <User className="h-3 w-3" />
              {currentOperator}
            </span>
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* 重置确认弹窗 */}
      {showResetConfirm && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-[360px] rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="font-display text-base font-semibold text-slate-800">
              确认重置演示数据？
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              此操作将清除所有复核记录、异常状态和备注，并恢复为初始演示数据。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="btn"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  setShowResetConfirm(false);
                }}
                className="btn btn-danger"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
