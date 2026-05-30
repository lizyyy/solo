import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Music,
  Monitor,
  Footprints,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '仓库总览' },
  { to: '/presets', icon: Music, label: '预设管理' },
  { to: '/compatibility', icon: Monitor, label: '型号兼容' },
  { to: '/pedals', icon: Footprints, label: '踏板映射' },
  { to: '/io', icon: ArrowRightLeft, label: '导入导出' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#12121E] border-r border-[#2A2A3E] flex flex-col transition-all duration-300 z-50 ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-5 border-b border-[#2A2A3E]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          ♪
        </div>
        {!collapsed && (
          <span className="text-[#FAF5EF] font-semibold text-sm truncate">
            音源预设版本仓库
          </span>
        )}
      </div>

      <nav className="flex-1 py-3 space-y-1 px-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive =
            to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-[#8A8AA0] hover:bg-[#1E1E32] hover:text-[#C8C8D8]'
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mb-4 py-2 rounded-lg bg-[#1E1E32] text-[#8A8AA0] hover:text-amber-400 hover:bg-[#2A2A3E] transition-all duration-200 flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
