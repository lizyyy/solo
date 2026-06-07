import { NavLink } from 'react-router-dom';
import {
  Home,
  FileText,
  Accessibility,
  MapPin,
  CheckSquare,
  BarChart3,
  History,
  Waves,
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { path: '/', label: '首页概览', icon: Home },
  { path: '/notices', label: '施工告示', icon: FileText },
  { path: '/ramps', label: '坡道记录', icon: Accessibility },
  { path: '/points', label: '点位清单', icon: MapPin },
  { path: '/review', label: '复核中心', icon: CheckSquare },
  { path: '/visualization', label: '可视化', icon: BarChart3 },
  { path: '/history', label: '变更历史', icon: History },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold text-primary">滨水驿站</h1>
            <p className="text-xs text-slate-500">人流预警系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  isActive ? 'sidebar-item-active' : 'sidebar-item'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-medium text-sm">姜</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">小姜</p>
            <p className="text-xs text-slate-500">街道规划员</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
