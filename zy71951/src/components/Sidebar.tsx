import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Upload,
  Plane,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/records", icon: ClipboardList, label: "巡检记录" },
  { to: "/import", icon: Upload, label: "数据导入" },
  { to: "/review", icon: Plane, label: "飞行复盘" },
];

export default function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-primary text-white flex flex-col z-30 transition-all duration-200",
        collapsed ? "w-16" : "w-sidebar"
      )}
    >
      <div className="h-header flex items-center px-4 border-b border-white/10">
        {!collapsed && (
          <span className="text-base font-semibold tracking-wide whitespace-nowrap">
            杆塔巡检系统
          </span>
        )}
        <button
          onClick={toggle}
          className={cn(
            "ml-auto flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 transition-colors",
            collapsed && "ml-0 mx-auto"
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-white/10">
        <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-steel flex items-center justify-center text-xs font-bold shrink-0">
            管
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">巡检员A</div>
              <div className="text-xs text-white/50">在线</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
