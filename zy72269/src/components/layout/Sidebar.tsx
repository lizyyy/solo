import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  Map,
  AlertTriangle,
  Compass,
  ClipboardCheck,
  FileText,
  BookOpen
} from 'lucide-react';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/replay', label: '路径回放', icon: Map },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle },
  { path: '/abnormal', label: 'Z轴复核', icon: Compass },
  { path: '/self-check', label: '自检中心', icon: ClipboardCheck },
  { path: '/report', label: '报告导出', icon: FileText },
  { path: '/sample', label: '样例演示', icon: BookOpen }
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-primary-900/80 border-r-2 border-primary-700 min-h-screen flex flex-col">
      <div className="p-6 border-b-2 border-primary-700">
        <h1 className="font-mono text-lg font-bold text-primary-200 tracking-wider">
          水下管线巡检标记
        </h1>
        <p className="text-xs text-primary-400 mt-1 font-mono">
          UNDERWATER PIPELINE SYSTEM
        </p>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 mx-2 mb-1 font-mono text-sm transition-all duration-200 border-l-4 ${
                  isActive
                    ? 'bg-primary-700/50 border-primary-400 text-primary-100 shadow-glow'
                    : 'border-transparent text-primary-300 hover:bg-primary-800/50 hover:text-primary-100 hover:border-primary-500'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.5} />
              <span className="tracking-wider">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t-2 border-primary-700">
        <div className="bg-primary-800/50 p-3 border border-primary-600">
          <p className="font-mono text-xs text-primary-300">
            设备工程师: 许工
          </p>
          <p className="font-mono text-xs text-primary-400 mt-1">
            {new Date().toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>
    </aside>
  );
}
