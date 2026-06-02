import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, MapPin, FileText, GitMerge, Download, RotateCcw } from "lucide-react";
import { useStore } from "@/store";

const NAV_ITEMS = [
  { to: "/", label: "点位看板", icon: LayoutDashboard },
  { to: "/feedback/new", label: "反馈录入", icon: FileText },
  { to: "/merge", label: "归并管理", icon: GitMerge },
  { to: "/export", label: "报告导出", icon: Download },
];

export default function Layout() {
  const resetToSeed = useStore((s) => s.resetToSeed);

  return (
    <div className="flex h-screen bg-zinc-50">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1A535C]" />
            <span className="text-sm font-bold text-[#1A535C] leading-tight">
              学校周边<br />慢行安全
            </span>
          </div>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#1A535C]/8 text-[#1A535C] font-semibold"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-zinc-200">
          <button
            onClick={resetToSeed}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重置为样例数据
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
