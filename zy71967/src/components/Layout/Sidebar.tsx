import { NavLink } from "react-router-dom"
import { LayoutDashboard, Database, ClipboardCheck, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "实验看板", icon: LayoutDashboard },
  { to: "/manage", label: "数据管理", icon: Database },
  { to: "/evaluation", label: "评估说明", icon: ClipboardCheck },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-50">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-slate-800">
        <FlaskConical className="w-5 h-5 text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-100 tracking-wide">推荐实验看板</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-amber-500/15 text-amber-400 font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="text-xs text-slate-500">v1.0 · 数据本地存储</div>
      </div>
    </aside>
  )
}
