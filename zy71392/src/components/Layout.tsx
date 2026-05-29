import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileCode, ShieldCheck, AlertTriangle, AlertCircle, FileBarChart,
  Menu, X
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '分析总览' },
  { path: '/import', icon: Upload, label: '导入脚本' },
  { path: '/scripts', icon: FileCode, label: '脚本列表' },
  { path: '/exceptions', icon: ShieldCheck, label: '例外管理' },
  { path: '/risks', icon: AlertTriangle, label: '风险评分' },
  { path: '/reports', icon: FileBarChart, label: '审计报告' },
];

export default function Layout() {
  const { sidebarOpen, toggleSidebar, toast, hideToast } = useAppStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-bg-primary">
      <aside className={`${sidebarOpen ? 'w-60' : 'w-0'} bg-bg-secondary border-r border-gray-700/50 transition-all duration-300 overflow-hidden flex-shrink-0 flex flex-col`}>
        <div className="p-5 border-b border-gray-700/50">
          <h1 className="text-lg font-bold text-brand-400 flex items-center gap-2">
            <ShieldCheck size={22} />
            权限最小化
          </h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => navigate(item.path)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-bg-tertiary'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-700/50 bg-bg-secondary/50 backdrop-blur flex items-center px-5 gap-4 flex-shrink-0">
          <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-200 transition-colors">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="text-xs text-gray-500">本地后端服务</div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-brand-600' :
          toast.type === 'error' ? 'bg-danger-500' : 'bg-bg-tertiary border border-gray-600'
        }`}>
          {toast.type === 'success' && <ShieldCheck size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          <span className="text-sm">{toast.message}</span>
          <button onClick={hideToast} className="ml-2 text-gray-300 hover:text-white"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
