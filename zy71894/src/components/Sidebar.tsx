import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Calendar,
  FileText,
  Users,
  BarChart3,
  Settings,
  Wind,
  ClipboardList,
} from 'lucide-react';

const navItems = [
  { path: '/schedule', label: '排程总表', Icon: Calendar },
  { path: '/team-records', label: '班组记录', Icon: Users },
  { path: '/condition-logs', label: '工况日志', Icon: BarChart3 },
  { path: '/thresholds', label: '阈值表', Icon: ClipboardList },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-industrial-900 min-h-screen flex flex-col">
      <div className="p-6 border-b border-industrial-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 flex items-center justify-center">
            <Wind className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-white text-lg">风洞排程</h1>
            <p className="text-xs text-industrial-400">WIND TUNNEL SCHEDULER</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map(({ path, label, Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all',
                    'hover:bg-industrial-800',
                    isActive
                      ? 'bg-primary-800 text-white border-l-4 border-l-primary-500'
                      : 'text-industrial-300 border-l-4 border-l-transparent'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-industrial-700">
        <div className="bg-industrial-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-industrial-600 flex items-center justify-center text-white text-sm font-mono">
              EQ
            </div>
            <div>
              <p className="text-white text-sm font-medium">设备工程师</p>
              <p className="text-xs text-industrial-400">工号: ENG-001</p>
            </div>
          </div>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-industrial-400 hover:text-white hover:bg-industrial-700 transition-colors">
            <Settings className="w-4 h-4" />
            系统设置
          </button>
        </div>
      </div>
    </aside>
  );
}
