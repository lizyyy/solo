import { NavLink, useLocation } from "react-router-dom"
import { Home, Route, Shield, Menu, X } from "lucide-react"
import { useState } from "react"

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const links = [
    { to: "/", icon: Home, label: "航线总览" },
    { to: "/", icon: Route, label: "航线管理" },
    { to: "/", icon: Shield, label: "安全审核" },
  ]

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-surface-800 border-r border-surface-500/30 flex flex-col transition-all duration-300 z-50 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-surface-500/30">
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-sm font-bold font-mono text-accent-green tracking-wider">PV-ROUTE</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">屋顶光伏航线管理</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-surface-600 transition-colors text-slate-400"
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {links.map((link) => {
          const isActive = location.pathname === link.to && link.label === "航线总览"
          return (
            <NavLink
              key={link.label}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                isActive
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-slate-400 hover:bg-surface-600 hover:text-slate-200"
              }`}
            >
              <link.icon size={18} className={isActive ? "text-accent-green" : "text-slate-500 group-hover:text-slate-300"} />
              {!collapsed && <span className="animate-fade-in">{link.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-3 border-t border-surface-500/30">
        {!collapsed && (
          <div className="animate-fade-in text-[10px] text-slate-600 font-mono">
            v1.0.0 · {new Date().getFullYear()}
          </div>
        )}
      </div>
    </aside>
  )
}
