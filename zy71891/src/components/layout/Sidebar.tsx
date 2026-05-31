import { NavLink } from 'react-router-dom';
import { AlertTriangle, History, User, LayoutDashboard } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/', label: '预警总览', icon: LayoutDashboard },
  { to: '/history', label: '操作历史', icon: History },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#1a1f2e] border-r border-gray-800 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">冷库热负荷预警</h1>
            <p className="text-xs text-gray-500">Cold Storage Warning</p>
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
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all',
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded bg-gray-800/30">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 truncate">张值班长</p>
            <p className="text-xs text-gray-500 truncate">工号: SZ2024001</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
