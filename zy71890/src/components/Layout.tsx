import { Link, useLocation } from "react-router-dom"
import { Activity, Upload, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/", label: "巡检时间线", icon: Activity },
  { path: "/import", label: "数据导入", icon: Upload },
  { path: "/report", label: "巡检报告", icon: FileText },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-slate-50">
      <nav className="flex w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-800">
        <div className="flex items-center gap-2 px-5 py-5">
          <Activity className="h-5 w-5 text-sky-400" />
          <span className="text-base font-semibold text-white">泵站振动巡检</span>
        </div>
        <div className="mt-2 flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
        <div className="mt-auto border-t border-slate-700 px-5 py-4">
          <p className="text-xs text-slate-500">设备工程师工具 v1.0</p>
        </div>
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
