import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  LineChart,
  AlertTriangle,
  FileText,
  History,
  Settings,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface SidebarProps {
  anomalyCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ anomalyCount = 0 }) => {
  const navItems: NavItem[] = [
    { to: '/', label: '工作台', icon: <LayoutDashboard size={18} /> },
    { to: '/analysis', label: '数据分析', icon: <LineChart size={18} /> },
    {
      to: '/anomalies',
      label: '异常管理',
      icon: <AlertTriangle size={18} />,
      badge: anomalyCount,
    },
    { to: '/reports', label: '分析报告', icon: <FileText size={18} /> },
    { to: '/history', label: '操作历史', icon: <History size={18} /> },
  ];

  return (
    <aside className="w-60 bg-slate-900/90 backdrop-blur border-r border-slate-700/50 flex flex-col">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-sm flex items-center justify-center glow-blue">
            <Cpu className="text-white" size={22} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">电机扭矩台架</div>
            <div className="text-xs text-slate-500">分析系统 v1.0</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-all duration-200',
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 glow-blue'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              )
            }
          >
            <span className={cn('transition-colors')}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto px-2 py-0.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-sm">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700/50">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-200">
          <Settings size={18} />
          <span>系统设置</span>
        </button>
      </div>
    </aside>
  );
};
