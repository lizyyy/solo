import { NavLink } from "react-router-dom";
import { ListMusic, History, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const navItems = [
  { path: "/", label: "音频列表", icon: ListMusic },
  { path: "/history", label: "处理历史", icon: History },
  { path: "/export", label: "导出中心", icon: Download },
];

export default function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "w-[240px] h-screen bg-bg-secondary border-r border-border-default flex flex-col",
        className
      )}
    >
      <div className="p-6 border-b border-border-default">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <ListMusic className="w-6 h-6 text-accent-cyan" />
          <span className="bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
            响度修正
          </span>
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary transition-all duration-200",
                  "hover:bg-bg-tertiary hover:text-text-primary",
                  isActive &&
                    "bg-accent-purple/20 text-accent-purple shadow-neon-purple border border-accent-purple/30"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border-default">
        <p className="text-xs text-text-muted">v1.0.0</p>
      </div>
    </aside>
  );
}
