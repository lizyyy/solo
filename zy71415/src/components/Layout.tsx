import { NavLink, Outlet } from "react-router-dom"
import { LayoutDashboard, FileText, Settings2, Vault } from "lucide-react"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "总览仪表盘" },
  { to: "/details", icon: FileText, label: "归集限额明细" },
  { to: "/rules", icon: Settings2, label: "规则与版本" },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0f1219] text-zinc-200 flex">
      <aside className="w-56 border-r border-zinc-800/60 bg-[#13161f] flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Vault className="w-4.5 h-4.5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-100 leading-tight">现金管理</h1>
              <p className="text-[10px] text-zinc-500 leading-tight">归集限额工具</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-sky-500/10 text-sky-400 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-zinc-800/60">
          <div className="text-[10px] text-zinc-600">
            规则版本 <span className="text-sky-400 font-mono">v3.2</span>
          </div>
          <div className="text-[10px] text-zinc-600 mt-1">数据更新 2026-05-28</div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
