import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  Download,
  Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/compare', label: '标签对比', icon: BarChart3 },
  { path: '/export', label: '结果导出', icon: Download },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-deep-blue-800/95 backdrop-blur-md border-r border-deep-blue-400/20 flex flex-col z-50">
      <div className="p-6 border-b border-deep-blue-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-purple-500 to-neon-purple-700 flex items-center justify-center shadow-glow-purple">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white">情绪标签</h1>
            <p className="text-xs text-deep-blue-300">复核管理系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                'animate-stagger',
                isActive
                  ? 'bg-neon-purple-600/20 text-neon-purple-300 border border-neon-purple-500/30 shadow-glow-purple'
                  : 'text-deep-blue-300 hover:bg-deep-blue-600/50 hover:text-white border border-transparent'
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Icon className={cn(
                'w-5 h-5 transition-transform duration-200',
                isActive ? 'text-neon-purple-400' : 'group-hover:scale-110'
              )} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-deep-blue-400/20">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-green-500 to-emerald-green-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">运</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">运营专员</p>
              <p className="text-xs text-deep-blue-400">music@company.com</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
