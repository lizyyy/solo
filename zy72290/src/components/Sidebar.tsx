import { LayoutDashboard, FileSpreadsheet, MapPin, Eye, History } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/safety-radius', label: '安全半径表', icon: FileSpreadsheet },
  { path: '/origin-spec', label: '坐标原点说明', icon: MapPin },
  { path: '/obstruction', label: '遮挡点清单', icon: Eye },
  { path: '/history', label: '历史记录', icon: History },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-sky-400">海岛风暴潮淹没沙盘</h1>
        <p className="text-xs text-slate-400 mt-1">安全半径核对演示系统</p>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-sm font-medium">
            景
          </div>
          <div>
            <p className="text-sm font-medium">阿景</p>
            <p className="text-xs text-slate-400">展陈设计师</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
