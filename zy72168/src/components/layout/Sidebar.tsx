import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  MessageSquare,
  FileText,
  BarChart3,
  Merge,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '数据看板', icon: LayoutDashboard },
  { path: '/points', label: '点位管理', icon: MapPin },
  { path: '/points/merge', label: '点位归并', icon: Merge },
  { path: '/feedbacks', label: '反馈记录', icon: MessageSquare },
  { path: '/plans', label: '方案版本', icon: FileText },
  { path: '/reports', label: '评估报告', icon: BarChart3 },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-wide">道路施工绕行评估系统</h1>
        <p className="text-xs text-slate-400 mt-1">街道办事处 · 业务协同平台</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
            周
          </div>
          <div>
            <p className="text-sm font-medium">周姐</p>
            <p className="text-xs text-slate-400">街道工作人员</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
