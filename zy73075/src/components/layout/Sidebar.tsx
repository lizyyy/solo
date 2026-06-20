import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileSearch, UploadCloud, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { to: '/', label: '首页', icon: LayoutDashboard },
  { to: '/workorder', label: '工单详情', icon: FileSearch },
  { to: '/import', label: '导入回放', icon: UploadCloud },
  { to: '/review', label: '异常复核', icon: AlertTriangle },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-700/70 bg-slate-900/80 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2 border-b border-slate-700/70 px-5">
        <span className="text-xl">🛡️</span>
        <h1 className="text-base font-semibold text-white">盾构刀盘工单回放</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  'text-slate-400 hover:bg-slate-800/60 hover:text-white',
                  isActive && 'bg-shield-500/30 text-white'
                )
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/70 px-5 py-3">
        <p className="text-xs text-slate-500">v1.0 · 本地存储</p>
      </div>
    </aside>
  );
}
