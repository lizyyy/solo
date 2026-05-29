import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Code2, 
  Server, 
  ShieldAlert, 
  Trash2, 
  FileBarChart, 
  Settings,
  Shield
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '开关总览' },
  { path: '/scan', icon: Code2, label: '代码扫描' },
  { path: '/environment', icon: Server, label: '环境对比' },
  { path: '/risk', icon: ShieldAlert, label: '风险评估' },
  { path: '/cleanup', icon: Trash2, label: '清理执行' },
  { path: '/reports', icon: FileBarChart, label: '报告中心' },
  { path: '/settings', icon: Settings, label: '系统设置' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-800 rounded-xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">FeatureFlag</h1>
            <p className="text-xs text-gray-400">清理器</p>
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
              isActive ? 'sidebar-link-active' : 'sidebar-link'
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 font-semibold">用</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">当前用户</p>
            <p className="text-xs text-gray-400">研发工程师</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
