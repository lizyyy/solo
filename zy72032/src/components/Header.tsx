import { Link, useLocation } from "react-router-dom"
import { Home, PlayCircle, History, BarChart3, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "首页", icon: Home },
  { to: "/training", label: "训练", icon: PlayCircle },
  { to: "/history", label: "记录", icon: History },
  { to: "/summary", label: "汇总", icon: BarChart3 },
]

export default function Header() {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-lg bg-brand-400 flex items-center justify-center shadow-lg shadow-brand-400/30 transition-transform group-hover:scale-110">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI客服训练营</h1>
              <p className="text-xs text-slate-400 -mt-0.5">每局1-2分钟 · 练完就能用</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-brand-400 text-white shadow-lg shadow-brand-400/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
