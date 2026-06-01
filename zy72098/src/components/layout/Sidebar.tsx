import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Calculator,
  Database,
  BarChart3,
  FileText,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/params', icon: Settings, label: '参数管理' },
  { path: '/calculation', icon: Calculator, label: '计算流程' },
  { path: '/samples', icon: Database, label: '样本管理' },
  { path: '/charts', icon: BarChart3, label: '图表分析' },
  { path: '/report', icon: FileText, label: '交接报告' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">GNN社区解释</h1>
            <p className="text-xs text-slate-400">交接管理系统</p>
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
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
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
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">当前批次</p>
          <p className="text-sm font-medium truncate">2024年第23周</p>
          <p className="text-xs text-cyan-400 mt-1">参数版本 V2.0</p>
        </div>
      </div>
    </aside>
  );
}
