import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  CheckSquare,
  Workflow,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/points', label: '点位清单', icon: MapPin },
  { path: '/conflicts', label: '冲突检测', icon: AlertTriangle },
  { path: '/self-check', label: '自检中心', icon: CheckSquare },
  { path: '/workflow', label: '流程工作台', icon: Workflow },
  { path: '/history', label: '历史记录', icon: History },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-primary-800 min-h-screen text-white flex flex-col">
      <div className="p-5 border-b border-primary-700">
        <h1 className="text-lg font-bold">校园周边摊贩疏导</h1>
        <p className="text-xs text-primary-300 mt-1">管理系统 v1.0</p>
      </div>

      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-primary-700 text-white border-l-4 border-amber-400'
                  : 'text-primary-200 hover:bg-primary-700 hover:text-white'
              )
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
            马
          </div>
          <div>
            <p className="text-sm font-medium">老马</p>
            <p className="text-xs text-primary-300">交通协管</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
