import { useState } from "react"
import { useLocation, Link } from "react-router-dom"
import { Coffee, Thermometer, GitCompare, ClipboardList, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useThresholdStore } from "@/store/useThresholdStore"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "数据看板", path: "/", icon: ClipboardList },
  { label: "热传导分析", path: "/analysis", icon: Thermometer },
  { label: "历史对比", path: "/comparison", icon: GitCompare },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const currentVersion = useThresholdStore((s) => s.currentVersion)

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-coffee-800 text-coffee-50 transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex items-center gap-2 border-b border-coffee-700 px-4 py-4">
        <Coffee className="h-6 w-6 shrink-0 text-coffee-300" />
        {!collapsed && (
          <h1 className="font-serif text-lg font-bold whitespace-nowrap">咖啡烘焙热传导</h1>
        )}
      </div>

      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isActive
                  ? "bg-coffee-700 text-coffee-50"
                  : "text-coffee-200 hover:bg-coffee-700/60 hover:text-coffee-50"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="font-sans text-sm">{label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-coffee-700 px-4 py-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2">
            <span className="font-sans text-xs text-coffee-300">阈值版本</span>
            <span className="rounded bg-coffee-600 px-2 py-0.5 font-mono text-xs text-coffee-100">
              v{currentVersion}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center text-coffee-300 hover:text-coffee-50 transition-colors"
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  )
}
