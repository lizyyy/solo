import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, ClipboardList, HelpCircle } from 'lucide-react';
import { cn } from '../../utils/status';

const navItems = [
  { path: '/', label: '飞行记录总览', icon: LayoutDashboard },
  { path: '/review', label: '飞行复盘导出', icon: FileText },
  { path: '/guide', label: '操作指引', icon: HelpCircle },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-primary-600 min-h-screen flex flex-col">
      <div className="p-4 border-b border-primary-700">
        <h1 className="text-white font-bold text-lg tracking-tight">农田病虫航拍</h1>
        <p className="text-primary-200 text-xs mt-1">管理系统 v1.0</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 mb-1 text-sm transition-colors',
                isActive
                  ? 'bg-primary-700 text-white border-l-2 border-farm-400'
                  : 'text-primary-200 hover:bg-primary-700 hover:text-white'
              )
            }
          >
            <item.icon size={18} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-primary-700">
        <div className="text-primary-300 text-xs">
          <p>当前用户：项目负责人</p>
          <p className="mt-1">今日日期：{new Date().toLocaleDateString('zh-CN')}</p>
        </div>
      </div>
    </aside>
  );
}
