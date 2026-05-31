import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Upload, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "回执看板", icon: LayoutDashboard },
  { to: "/import", label: "导入", icon: Upload },
  { to: "/export", label: "导出", icon: Download },
];

function formatDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100">
      <aside
        className={cn(
          "flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-200",
          collapsed ? "w-16" : "w-52"
        )}
      >
        <div
          className={cn(
            "flex items-center h-14 px-4 border-b border-zinc-800",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <div className="w-7 h-7 rounded bg-amber-500 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-4 h-4 text-zinc-900" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-zinc-100 whitespace-nowrap">
              渠道返佣回执
            </span>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-zinc-800 text-amber-500"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-zinc-200 shrink-0">
          <h1 className="text-base font-semibold text-zinc-800">渠道返佣回执</h1>
          <span className="text-sm text-zinc-500">{formatDate()}</span>
        </header>

        <main className="flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
