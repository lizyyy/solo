import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  History,
  Users,
  FileDown,
  FlaskConical
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/import', icon: Upload, label: '导入作品' },
  { path: '/class', icon: Users, label: '班级概览' },
  { path: '/export', icon: FileDown, label: '报告导出' },
  { path: '/samples', icon: FlaskConical, label: '样例中心' },
];

export function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>
          美术课堂配色点评
        </h1>
        <p className="text-xs text-slate-400 mt-1">数据化色彩教学工具</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-md text-sm
                  transition-all duration-200
                  ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">数据存储</p>
          <p className="text-sm text-slate-300">本地 IndexedDB</p>
          <p className="text-xs text-slate-500 mt-1">数据安全，离线可用</p>
        </div>
      </div>
    </aside>
  );
}
