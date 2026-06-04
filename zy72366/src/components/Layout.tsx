import { NavLink, Outlet } from "react-router-dom"
import { Upload, FileCheck, AlertTriangle, Thermometer } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/import", label: "温度校准记录导入", icon: Upload },
  { path: "/review", label: "传感器编号审阅", icon: FileCheck },
  { path: "/anomalies", label: "异常工况表", icon: AlertTriangle },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-[#1B2A4A] text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E8792B] flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">冰箱门封漏热</h1>
              <p className="text-xs text-gray-400">检测系统</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-[#E8792B] text-white shadow-lg shadow-[#E8792B]/30"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-gray-400">
            <p>版本 v1.0.0</p>
            <p className="mt-1">© 2024 工业检测系统</p>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
