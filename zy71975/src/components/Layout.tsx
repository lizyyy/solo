import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  Upload,
  Search,
  Edit3,
  History,
  Download,
  Menu,
  X,
  FileText,
} from 'lucide-react';
import KnowledgeChangeAlert from './KnowledgeChangeAlert';
import Toast from './Toast';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/import', label: '导入', icon: Upload },
  { path: '/review', label: '复核', icon: Search },
  { path: '/correct', label: '修正', icon: Edit3 },
  { path: '/history', label: '历史', icon: History },
  { path: '/export', label: '导出', icon: Download },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-primary text-white transition-all duration-300 flex flex-col shadow-lg`}
      >
        <div className="p-4 flex items-center justify-between border-b border-primary-light">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-orange-500" />
            {sidebarOpen && (
              <span className="text-xl font-bold whitespace-nowrap">会议纪要纠偏</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-primary-light rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md scale-[1.02]'
                    : 'text-white/80 hover:bg-primary-light hover:text-white hover:scale-[1.02]'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-primary-light text-sm text-white/60">
            <p>版本 1.0.0</p>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <KnowledgeChangeAlert />

        <main className="flex-1 p-6 overflow-auto animate-fadeIn">
          <Outlet />
        </main>
      </div>

      <Toast />
    </div>
  );
}
