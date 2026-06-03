import { NavLink } from "react-router-dom"
import { LayoutDashboard, FileSearch, Play, ShieldCheck } from "lucide-react"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "主控台" },
  { to: "/counter-examples", icon: FileSearch, label: "反例管理" },
  { to: "/runs", icon: Play, label: "材料运行" },
  { to: "/checks", icon: ShieldCheck, label: "自检与导出" },
]

export default function Sidebar() {
  return (
    <aside className="w-56 h-screen bg-[#12122a] border-r border-[#2a2a4a] flex flex-col shrink-0">
      <div className="px-5 py-6">
        <h1 className="text-lg font-bold text-[#0ff0b3] tracking-wide" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          梯度下降学习率演示
        </h1>
        <p className="text-xs text-[#555577] mt-1">反例验证与数据自检</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-[#1a1a3e] text-[#0ff0b3] border-l-2 border-[#0ff0b3]"
                  : "text-[#8888aa] hover:text-[#ccccdd] hover:bg-[#16163a]"
              }`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-[10px] text-[#555577] border-t border-[#2a2a4a]">
        v1.0 · 教学工具
      </div>
    </aside>
  )
}
