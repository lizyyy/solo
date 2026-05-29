import { NavLink, Outlet } from "react-router-dom"
import {
  Upload,
  AlignCenterHorizontal,
  Tag,
  GitBranch,
  FileDown,
  Music,
} from "lucide-react"
import { useStore } from "@/store"
import { useState } from "react"

const navItems = [
  { to: "/import", icon: Upload, label: "导入工作台" },
  { to: "/align", icon: AlignCenterHorizontal, label: "对齐检测" },
  { to: "/annotate", icon: Tag, label: "片段标注" },
  { to: "/versions", icon: GitBranch, label: "版本管理" },
  { to: "/export", icon: FileDown, label: "报告导出" },
]

export default function Layout() {
  const { currentSessionId, sessions, selectSession } = useStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#0F0F1A] text-gray-200 font-['Noto_Sans_SC',sans-serif]">
      <aside
        className={`${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static z-40 w-64 h-full bg-[#12122A] border-r border-[#2A2A4A] flex flex-col transition-transform duration-200`}
      >
        <div className="p-5 border-b border-[#2A2A4A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-amber-400 leading-tight">排练迟到</h1>
              <h2 className="text-xs text-gray-500 leading-tight">分轨整理工具</h2>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-[#2A2A4A]">
          <label className="text-xs text-gray-500 mb-1.5 block">当前排练场次</label>
          <select
            value={currentSessionId || ""}
            onChange={(e) => selectSession(e.target.value)}
            className="w-full bg-[#1A1A35] border border-[#2A2A4A] rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">选择场次...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#1A1A35] border border-transparent"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2A2A4A]">
          <div className="text-xs text-gray-600 text-center">
            v1.0.0 · 浏览器端运算
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#12122A] border-b border-[#2A2A4A] px-4 py-3 flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-bold text-amber-400">排练迟到 · 分轨整理</span>
        </div>
        <div className="md:p-0 p-12 md:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
