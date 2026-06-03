import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  FileCode,
  AlertTriangle,
  Compass,
  ShieldCheck,
  Clock,
  FileText,
} from 'lucide-react';

const navItems = [
  { to: '/', label: '工作流面板', icon: LayoutDashboard },
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/cad', label: 'CAD补录', icon: FileCode },
  { to: '/conflicts', label: '冲突处理', icon: AlertTriangle },
  { to: '/coordinates', label: '坐标复核', icon: Compass },
  { to: '/self-check', label: '自检中心', icon: ShieldCheck },
  { to: '/history', label: '历史追溯', icon: Clock },
  { to: '/instructions', label: '现场说明', icon: FileText },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 bg-primary-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-primary-700">
          <h1 className="font-display text-lg font-bold tracking-wide">船舶机舱管线定位</h1>
          <p className="text-primary-300 text-xs mt-1 font-mono-data">Pipeline Positioning System</p>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-display transition-colors duration-150 ${
                  isActive
                    ? 'bg-primary-700 text-white border-l-3 border-industrial-orange'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-primary-700 text-xs text-primary-300 font-mono-data">
          v1.0.0 · 本地模式
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
