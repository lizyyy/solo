import { NavLink, useLocation } from 'react-router-dom';
import {
  Upload,
  Tags,
  ShieldCheck,
  FileBarChart,
  AlertTriangle,
  Music2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '数据导入', icon: Upload },
  { path: '/labels', label: '情绪标签', icon: Tags },
  { path: '/review', label: '异常复核', icon: AlertTriangle },
  { path: '/self-check', label: '自检中心', icon: ShieldCheck },
  { path: '/weekly-report', label: '周报生成', icon: FileBarChart },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-60 bg-[#1e3a5f] min-h-screen flex flex-col">
      <div className="p-5 border-b border-[#2c5282]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#dd6b20] rounded flex items-center justify-center">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-wide">
              音频样本
            </h1>
            <p className="text-[#90cdf4] text-xs">情绪标签管理系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-5 py-3 text-sm transition-all duration-200',
                isActive
                  ? 'bg-[#2c5282] text-white border-l-4 border-[#dd6b20]'
                  : 'text-[#a0aec0] hover:bg-[#2c5282]/50 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#2c5282]">
        <div className="text-[#718096] text-xs">
          <p>版本 1.0.0</p>
          <p className="mt-1">数据自动保存至本地</p>
        </div>
      </div>
    </aside>
  );
};
