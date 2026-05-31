import {
  Receipt,
  LayoutDashboard,
  FileText,
  Upload,
  Download,
  History,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "工作台", icon: LayoutDashboard },
  { to: "/settlements", label: "结算明细", icon: FileText },
  { to: "/import", label: "导入中心", icon: Upload },
  { to: "/export", label: "导出中心", icon: Download },
  { to: "/history", label: "操作历史", icon: History },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "结算工作台",
  "/settlements": "结算明细",
  "/import": "导入中心",
  "/export": "导出中心",
  "/history": "操作历史",
};

export default function Layout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || "联名活动结算";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="flex w-56 flex-shrink-0 flex-col bg-teal-900 text-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Receipt className="h-6 w-6 text-amber-400" />
          <span className="text-lg font-bold tracking-wide">
            联名活动结算
          </span>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-800 text-white shadow-sm"
                    : "text-teal-200 hover:bg-teal-800/50 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`absolute left-0 h-8 w-1 rounded-r-full transition-opacity ${
                      isActive ? "bg-amber-400 opacity-100" : "opacity-0"
                    }`}
                  />
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-teal-800 px-5 py-4 text-xs text-teal-400">
          © 2026 结算系统
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center border-b border-slate-200 bg-white px-6">
          <h1 className="text-base font-semibold text-slate-800">{title}</h1>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
