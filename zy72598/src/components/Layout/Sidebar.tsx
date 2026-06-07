import { NavLink } from 'react-router-dom';
import {
  Home,
  FileText,
  AlertTriangle,
  CheckSquare,
  History,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '实验工作台', icon: Home },
  { path: '/summary', label: '可解释摘要', icon: FileText },
  { path: '/conflicts', label: '冲突中心', icon: AlertTriangle },
  { path: '/self-check', label: '自检中心', icon: CheckSquare },
  { path: '/history', label: '历史记录', icon: History },
];

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg" style={{ fontFamily: "'Source Serif Pro', serif" }}>
              多目标排序
            </h1>
            <p className="text-xs text-slate-400">权衡实验平台</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold text-white">
            越
          </div>
          <div>
            <p className="text-sm font-medium">阿越</p>
            <p className="text-xs text-slate-400">实验平台负责人</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
