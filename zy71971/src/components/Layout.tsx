import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, FileQuestion, ClipboardCheck, Upload, BarChart3, Scale } from 'lucide-react';

const navItems = [
  { to: '/', label: '问答总览', icon: LayoutDashboard },
  { to: '/qa', label: '条款问答', icon: FileQuestion },
  { to: '/review', label: '争议复核', icon: ClipboardCheck },
  { to: '/import', label: '导入管理', icon: Upload },
  { to: '/report', label: '质检报表', icon: BarChart3 },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#0f1724]">
      <aside className="w-60 flex-shrink-0 bg-[#1a2332] border-r border-[#2a3548] flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-[#2a3548]">
          <Scale className="w-6 h-6 text-amber-400 mr-2.5" />
          <span className="text-base font-semibold text-gray-100 tracking-wide">合同条款问答</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-400/10 text-amber-400 font-medium'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[#2a3548]">
          <p className="text-xs text-gray-500">v1.0.0 · 合同条款问答管理系统</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
