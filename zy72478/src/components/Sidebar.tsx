
import { NavLink } from 'react-router-dom';
import {
  Home,
  Upload,
  Map,
  AlertTriangle,
  ClipboardCheck,
  History,
  Building2,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: '首页概览' },
  { path: '/import', icon: Upload, label: '数据导入' },
  { path: '/heatmap', icon: Map, label: '热力图' },
  { path: '/conflicts', icon: AlertTriangle, label: '冲突处理' },
  { path: '/self-check', icon: ClipboardCheck, label: '自检中心' },
  { path: '/history', icon: History, label: '历史记录' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-[#1e3a5f] text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f59e0b] rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">城市更新租户安置</h1>
            <p className="text-xs text-white/60">数据管理平台</p>
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
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#f59e0b] text-white shadow-lg'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-white/60 mb-1">当前用户</p>
          <p className="font-medium">社区书记-周姐</p>
        </div>
      </div>
    </aside>
  );
}
