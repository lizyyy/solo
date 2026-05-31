import { NavLink } from "react-router-dom";
import {
  Camera,
  Upload,
  LayoutDashboard,
  CheckSquare,
  Clock,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/import", label: "导入", icon: Upload },
  { to: "/board", label: "标记看板", icon: LayoutDashboard },
  { to: "/review", label: "复核修正", icon: CheckSquare },
  { to: "/history", label: "历史记录", icon: Clock },
  { to: "/export", label: "导出", icon: Download },
];

export default function Sidebar() {
  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-white/5",
        "md:w-16 lg:w-56",
        "transition-all duration-300"
      )}
      style={{ backgroundColor: "#1a1a2e" }}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-4">
        <Camera size={22} style={{ color: "#e94560" }} />
        <span
          className={cn(
            "text-base font-semibold tracking-wide",
            "md:hidden lg:inline"
          )}
          style={{ color: "#eaeaea", fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}
        >
          摄影选片标记
        </span>
      </div>

      <nav className="flex-1 py-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                "md:justify-center lg:justify-start",
                isActive
                  ? "border-l-[3px] font-medium"
                  : "border-l-[3px] border-transparent hover:bg-white/5"
              )
            }
            style={({ isActive }) => ({
              color: isActive ? "#eaeaea" : "#9ca3af",
              backgroundColor: isActive ? "rgba(233, 69, 96, 0.1)" : undefined,
              borderLeftColor: isActive ? "#e94560" : "transparent",
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            })}
          >
            <Icon size={18} />
            <span className="md:hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
