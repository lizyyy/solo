import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  FileCheck,
  AlertTriangle,
  Signature,
  GitCompare,
  FileText,
  Music2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/check', label: '检查执行', icon: FileCheck },
  { path: '/exceptions', label: '异常汇总', icon: AlertTriangle },
  { path: '/signoff', label: '签收管理', icon: Signature },
  { path: '/compare', label: '变更对比', icon: GitCompare },
  { path: '/report', label: '报告导出', icon: FileText },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-primary-500 text-white min-h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-primary-400">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg">乐谱检查</h1>
            <p className="text-xs text-primary-200">Orchestra Score Checker</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-white text-primary-600 shadow-md'
                      : 'hover:bg-primary-600 text-primary-100'
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

      <div className="p-4 border-t border-primary-400">
        <div className="text-xs text-primary-200 text-center">
          <p>版本 1.0.0</p>
          <p className="mt-1">© 2026 乐谱检查系统</p>
        </div>
      </div>
    </aside>
  );
}
