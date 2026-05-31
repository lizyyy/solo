import { NavLink, Outlet } from "react-router-dom"
import { Activity, ClipboardCheck, FileBarChart, BookOpen } from "lucide-react"

const navItems = [
  { to: "/timeline", label: "统一时间线", icon: Activity },
  { to: "/inspection", label: "版本巡检", icon: ClipboardCheck },
  { to: "/weekly-report", label: "质检周报", icon: FileBarChart },
  { to: "/guide", label: "收尾说明", icon: BookOpen },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-slate-800 text-slate-300 flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-slate-700">
          <h1 className="text-base font-semibold text-white tracking-wide">提示词版本巡检</h1>
          <p className="text-xs text-slate-400 mt-1">运营分析师工具</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-slate-700/60 text-amber-400 border-r-2 border-amber-400"
                    : "hover:bg-slate-700/40 hover:text-white"
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-700">
          <p className="text-[10px] text-slate-500">v1.0 · 内部工具</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
