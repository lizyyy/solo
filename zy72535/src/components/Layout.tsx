import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Layers,
  BarChart3,
  Eye,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '审查总览' },
  { path: '/rules', icon: FileText, label: '脱敏规则管理' },
  { path: '/batches', icon: Layers, label: '灰度批次管理' },
  { path: '/visualization', icon: BarChart3, label: '可视化展示' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-primary-500 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-primary-400">
          <h1 className="text-xl font-serif font-bold flex items-center gap-2">
            <Eye className="w-6 h-6 text-accent-amber" />
            虚拟主播脚本
            <br />
            安全审查系统
          </h1>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600 border-l-4 border-accent-amber text-white'
                    : 'text-primary-100 hover:bg-primary-600 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-400">
          <div className="text-xs text-primary-200">
            <p>当前用户：模型评测同事小孟</p>
            <p className="mt-1">角色：模型评测 / 安全审核</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
