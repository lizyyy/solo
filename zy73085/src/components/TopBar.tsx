import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home, User } from "lucide-react";

const BREADCRUMB_LABELS: Record<string, { label: string; parent?: string }> = {
  "/": { label: "总览仪表盘" },
  "/model": { label: "模型标注视图" },
  "/minutes": { label: "会议纪要管理" },
  "/materials": { label: "材料批次校验" },
  "/anomalies": { label: "异常队列追溯" },
  "/export": { label: "导出中心" },
};

export default function TopBar() {
  const location = useLocation();
  const crumb = BREADCRUMB_LABELS[location.pathname] || { label: location.pathname };
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <header className="h-16 border-b border-ink-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40 shrink-0">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/" className="p-1.5 rounded-eng hover:bg-ink-100 text-ink-500 transition-colors">
            <Home size={14} />
          </Link>
          <ChevronRight size={14} className="text-ink-300" />
          <span className="font-bold text-ink-900">{crumb.label}</span>
          <span className="ml-2 eng-tag bg-ink-100 text-ink-500 font-mono text-[10px]">
            {location.pathname}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-ink-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-safe-500 animate-pulse" />
            <span>本地持久化 · LocalStorage 已连接</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-eng bg-ink-50 text-xs text-ink-600">
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-eng bg-brand-50 border border-brand-100">
            <div className="w-7 h-7 rounded-eng bg-brand-600 text-white flex items-center justify-center">
              <User size={14} />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-bold text-brand-800">算法值班</div>
              <div className="text-[10px] text-brand-600 font-mono">Engineer On Duty</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
