import { NavLink } from 'react-router-dom';
import { Building2, List, FileSpreadsheet, Home } from 'lucide-react';
import { cn } from '@/utils';

const navItems = [
  { path: '/', label: '3D场景', icon: Building2 },
  { path: '/records', label: '记录管理', icon: List },
  { path: '/export', label: '导出报告', icon: FileSpreadsheet },
];

export function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Home className="w-8 h-8 text-primary-400" />
          <div>
            <h1 className="text-lg font-bold">建筑日照推演</h1>
            <p className="text-xs text-slate-400">教学辅助系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 text-center">
          本地运行 · 数据自动保存
        </div>
      </div>
    </div>
  );
}
