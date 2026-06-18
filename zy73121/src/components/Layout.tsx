import { AlertTriangle, Upload, Waves } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', icon: AlertTriangle, label: '异常队列' },
  { to: '/import', icon: Upload, label: '船上记录导入' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <aside className="w-64 h-screen flex flex-col bg-gradient-to-b from-[#0A2540] to-[#0E1F38] shrink-0">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
          <Waves className="w-7 h-7 text-[#00E5A0]" />
          <h1 className="text-lg font-semibold text-white tracking-wide">
            浮标海况异常预警
          </h1>
        </div>

        <nav className="flex-1 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors border-l-3 ${
                  isActive
                    ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-l-[3px] border-[#00E5A0]'
                    : 'text-[#94A3B8] hover:text-white border-l-[3px] border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-white/5">
          <p className="text-xs text-slate-600">数据持久化: localStorage</p>
        </div>
      </aside>

      <main className="flex-1 bg-[#0F172A] min-h-screen p-6">{children}</main>
    </div>
  );
}
