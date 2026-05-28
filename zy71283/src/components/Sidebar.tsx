import { NavLink, useLocation } from 'react-router-dom';
import { Palette, FileText, LayoutDashboard } from 'lucide-react';

const navItems = [
  { to: '/', label: '配色总览', icon: LayoutDashboard },
  { to: '/report', label: '分析报告', icon: FileText },
];

export default function Sidebar() {
  const location = useLocation();
  const isWorkPage = location.pathname.startsWith('/work/');

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-bg-secondary border-r border-border-custom flex flex-col z-50">
      <div className="px-5 py-6 border-b border-border-custom">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-warm/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-accent-warm" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold text-text-primary leading-tight">配色距离</h1>
            <p className="text-[10px] text-text-secondary tracking-wider uppercase">Palette Metric</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = item.to === '/' ? !isWorkPage && location.pathname === '/' : location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-accent-warm/15 text-accent-warm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border-custom">
        <p className="text-[10px] text-text-secondary">CIEDE2000 距离引擎</p>
        <p className="text-[10px] text-text-secondary mt-0.5">v1.0 · 纯前端计算</p>
      </div>
    </aside>
  );
}
