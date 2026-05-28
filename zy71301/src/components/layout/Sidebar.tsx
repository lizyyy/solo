import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Settings,
  FileBarChart,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '数据概览' },
  { path: '/session', icon: Activity, label: '会话分析' },
  { path: '/anomalies', icon: AlertTriangle, label: '异常详情' },
  { path: '/rules', icon: Settings, label: '规则配置' },
  { path: '/export', icon: FileBarChart, label: '报告导出' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-600 flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white">VR 晕动分析</h1>
            <p className="text-xs text-dark-400">Motion Sickness Analyzer</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-300 hover:bg-dark-700 hover:text-dark-100'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-600">
        <div className="glass rounded-lg p-4">
          <div className="text-xs text-dark-400 mb-2">系统状态</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-sm text-dark-200">服务正常运行</span>
          </div>
          <div className="mt-2 text-xs text-dark-500">
            规则版本: v1.0.0
          </div>
        </div>
      </div>
    </aside>
  );
}
