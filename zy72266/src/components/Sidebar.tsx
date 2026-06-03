import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  BarChart3,
  History,
  LogOut,
  User,
} from "lucide-react";
import { useGateStore } from "@/store/useGateStore";
import type { OperatorRole } from "@/types";

const NAV_ITEMS = [
  { path: "/", label: "系统概览", icon: LayoutDashboard },
  { path: "/import", label: "安全半径表导入", icon: Upload },
  { path: "/review", label: "坐标原点说明审核", icon: ClipboardCheck },
  { path: "/display", label: "闸门开度展示", icon: BarChart3 },
  { path: "/audit", label: "审计追踪", icon: History },
];

export default function Sidebar() {
  const location = useLocation();
  const currentUser = useGateStore((s) => s.currentUser);
  const logout = useGateStore((s) => s.logout);

  const roleLabel = (role: OperatorRole) =>
    role === "instructor" ? "培训教官" : "现场班组";

  return (
    <aside className="w-60 min-h-screen flex flex-col border-r"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="px-5 py-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        <h1 className="text-lg font-bold" style={{ color: "var(--color-steel)" }}>
          水库闸门开度展示
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          安全半径表管理系统
        </p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: isActive ? "var(--color-steel)" : "transparent",
                color: isActive ? "#fff" : "var(--color-text-muted)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
                  e.currentTarget.style.color = "var(--color-text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--color-text-muted)";
                }
              }}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
        {currentUser ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: "var(--color-steel)", color: "#fff" }}>
              {currentUser.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {currentUser.name}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {roleLabel(currentUser.role)}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="px-3 py-2">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              <User size={14} className="inline mr-1" />
              未登录
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
