import { NavLink, Outlet } from "react-router-dom"
import {
  FolderOpen,
  Upload,
  FileSearch,
  ClipboardCheck,
  Clock,
  ShieldCheck,
} from "lucide-react"

const navItems = [
  { to: "/", label: "证据包总览", icon: FolderOpen },
  { to: "/import", label: "托管确认导入", icon: Upload },
  { to: "/supplement", label: "除权日补录", icon: FileSearch },
  { to: "/audit", label: "审计明细", icon: ClipboardCheck },
  { to: "/history", label: "历史记录", icon: Clock },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">
      <aside className="w-64 flex-shrink-0 bg-pine-800 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-pine-700">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-gold-400" />
            <div>
              <h1 className="font-serif text-base font-semibold tracking-wide text-gold-300">
                支付拒付
              </h1>
              <p className="text-xs text-pine-300 mt-0.5">证据包整理</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-pine-700 text-white shadow-md"
                    : "text-pine-200 hover:bg-pine-700/50 hover:text-white"
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-pine-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gold-400 flex items-center justify-center text-pine-900 text-xs font-bold">
              周
            </div>
            <div>
              <p className="text-sm font-medium text-white">投研助理小周</p>
              <p className="text-xs text-pine-300">在岗</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
