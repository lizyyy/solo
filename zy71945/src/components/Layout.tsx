import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  Search,
  ClipboardCheck,
  FileText,
  Satellite,
} from "lucide-react";

const navItems = [
  { to: "/timeline", icon: LayoutDashboard, label: "时间线总览" },
  { to: "/import", icon: Upload, label: "数据导入" },
  { to: "/analysis", icon: Search, label: "遮挡分析" },
  { to: "/review", icon: ClipboardCheck, label: "复核修正" },
  { to: "/briefing", icon: FileText, label: "任务简报" },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#0B1426] text-slate-200">
      <aside className="w-56 flex-shrink-0 border-r border-slate-700/50 bg-[#0a1120] flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold tracking-wide text-slate-100">
              星敏感器遮挡
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Occlusion Analysis Tool</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-amber-400/10 text-amber-400 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-600">本地工具 · IndexedDB</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
