import { NavLink, useLocation } from 'react-router-dom'
import {
  Music, FileText, Globe, Percent, CalendarDays,
  ClipboardList, ChevronLeft, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/samples', label: '采样清单', icon: Music },
  { to: '/contracts', label: '授权合同', icon: FileText },
  { to: '/platforms', label: '平台范围', icon: Globe },
  { to: '/royalties', label: '分成规则', icon: Percent },
  { to: '/releases', label: '发行计划', icon: CalendarDays },
  { to: '/report', label: '台账报告', icon: ClipboardList },
]

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-forest-700 text-white md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-40 transition-all duration-300 bg-forest-700 text-white flex flex-col
          ${collapsed ? 'w-16' : 'w-56'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 h-16 border-b border-forest-600`}>
          {!collapsed && (
            <h1 className="font-serif-title text-lg font-semibold text-amber-300 truncate">
              版权采样台账
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1 rounded hover:bg-forest-600 transition-colors"
          >
            <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-colors text-sm
                  ${isActive
                    ? 'bg-amber-400/20 text-amber-300 font-medium'
                    : 'text-forest-200 hover:bg-forest-600 hover:text-white'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className={`px-4 py-3 border-t border-forest-600 text-xs text-forest-400 ${collapsed ? 'text-center' : ''}`}>
          {collapsed ? '©' : '© 版权采样授权台账'}
        </div>
      </aside>

      <div className={`transition-all duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-56'}`} />
    </>
  )
}
