import { NavLink, Outlet } from "react-router-dom"
import { Shield, Database, Play, BarChart3, FileDown, RotateCcw } from "lucide-react"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/samples", icon: Database, label: "样本管理" },
  { to: "/replay", icon: Play, label: "回放复核" },
  { to: "/metrics", icon: BarChart3, label: "指标对比" },
  { to: "/report", icon: FileDown, label: "报告导出" },
]

export default function Layout() {
  const resetData = useStore((s) => s.resetData)

  return (
    <div className="dark flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">安全回放</h1>
            <p className="text-[10px] text-zinc-500">聊天机器人安全回放工具</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-amber-500/10 text-amber-400 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-800 px-3 py-4">
          <button
            onClick={resetData}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            <RotateCcw className="h-4 w-4" />
            重置数据
          </button>
          <div className="mt-3 px-3">
            <p className="text-[10px] text-zinc-600">标注负责人：周姐</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-zinc-900">
        <Outlet />
      </main>
    </div>
  )
}
