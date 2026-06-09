import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  FileText,
  Package,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";

const navItems = [
  { path: "/", label: "总览仪表盘", icon: LayoutDashboard, badge: "Dashboard" },
  { path: "/model", label: "模型标注视图", icon: Map, badge: "Model" },
  { path: "/minutes", label: "会议纪要管理", icon: FileText, badge: "Minutes" },
  { path: "/materials", label: "材料批次校验", icon: Package, badge: "Materials" },
  { path: "/anomalies", label: "异常队列追溯", icon: AlertTriangle, badge: "Anomalies" },
  { path: "/export", label: "导出中心", icon: Download, badge: "Export" },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIGlobalStore();

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col border-r border-ink-200 bg-white/90 backdrop-blur-sm transition-all duration-300 ${
        sidebarCollapsed ? "w-[72px]" : "w-[248px]"
      }`}
    >
      <div className="h-16 flex items-center gap-3 px-4 border-b border-ink-200 shrink-0">
        <div className="w-9 h-9 rounded-eng bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white shadow-eng shrink-0">
          <Building2 size={18} />
        </div>
        {!sidebarCollapsed && (
          <div className="leading-tight">
            <div className="text-[13px] font-black text-ink-900 tracking-wide">STR-GRID</div>
            <div className="text-[10px] text-ink-500 font-medium">结构加固图纸复核</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto scrollbar-eng">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 px-3 py-2.5 rounded-eng text-sm font-medium transition-all",
                "hover:bg-ink-100 hover:text-ink-900",
                isActive
                  ? "bg-brand-50 text-brand-700 border border-brand-200 shadow-sm"
                  : "text-ink-600 border border-transparent",
              ].join(" ")
            }
          >
            <item.icon
              size={18}
              strokeWidth={2}
              className="shrink-0 transition-transform group-hover:scale-110"
            />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.label}</div>
                <div className="text-[10px] font-mono text-ink-400 uppercase tracking-wider">
                  {item.badge}
                </div>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-ink-200 shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-eng text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-all"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          {!sidebarCollapsed && <span>收起侧栏</span>}
        </button>
      </div>
    </aside>
  );
}
