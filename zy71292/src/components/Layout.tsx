import { Link, useLocation } from "react-router-dom"
import { Upload, Network, FileText, History, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store"

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const reset = useAppStore((s) => s.reset)
  const dataLoaded = useAppStore((s) => s.dataLoaded)

  const navItems = [
    { path: "/", label: "数据输入", icon: Upload },
    { path: "/workspace", label: "分组工作台", icon: Network, disabled: !dataLoaded },
    { path: "/report", label: "分组报告", icon: FileText, disabled: !dataLoaded },
    { path: "/history", label: "历史记录", icon: History },
  ]

  return (
    <div className="min-h-screen flex">
      <nav className="w-56 bg-slate-900/80 backdrop-blur-sm border-r border-slate-700/50 flex flex-col grain-overlay">
        <div className="p-5 border-b border-slate-700/50">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-400" />
            社群拆分器
          </h1>
          <p className="text-xs text-slate-400 mt-1">图论分组工具</p>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.disabled ? "#" : item.path}
                onClick={(e) => {
                  if (item.disabled) {
                    e.preventDefault()
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : item.disabled
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {item.disabled && (
                  <span className="text-[10px] text-slate-500 ml-auto">需加载数据</span>
                )}
              </Link>
            )
          })}
        </div>

        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置所有数据
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
