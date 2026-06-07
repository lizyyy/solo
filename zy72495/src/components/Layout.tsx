import { useState } from 'react';
import {
  LayoutDashboard,
  Bus,
  FileText,
  Repeat,
  Map,
  History,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { showToast } from '@/utils/errorMessageUtils';

const menuItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/bus-time', label: '公交刷卡时段', icon: Bus },
  { path: '/redline-remark', label: '红线图备注', icon: FileText },
  { path: '/stall-rotation', label: '摊位轮换', icon: Repeat },
  { path: '/map-view', label: '地图展示', icon: Map },
  { path: '/history', label: '操作历史', icon: History },
  { path: '/review', label: '复核中心', icon: ClipboardCheck, roles: ['manager', 'admin'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAppStore();

  const handleLogout = () => {
    logout();
    showToast('已退出登录', 'success');
    navigate('/login');
  };

  const filteredMenuItems = menuItems.filter(
    (item) => !item.roles || (currentUser && item.roles.includes(currentUser.role))
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-blue-900 to-blue-800 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        <div className="p-4 border-b border-blue-700/50 flex items-center justify-between">
          {sidebarOpen && (
            <h1 className="text-xl font-bold font-serif tracking-wide">早市管理系统</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-blue-700/50 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 py-4">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-white/20 shadow-lg'
                    : 'hover:bg-white/10'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-amber-300' : ''} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight size={16} className="text-amber-300" />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {currentUser && (
          <div className="p-4 border-t border-blue-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                {currentUser.name.charAt(0)}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{currentUser.name}</p>
                  <p className="text-xs text-blue-300 truncate">
                    {currentUser.role === 'staff' && '社区工作人员'}
                    {currentUser.role === 'manager' && '项目经理'}
                    {currentUser.role === 'admin' && '系统管理员'}
                  </p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-500/30 rounded-lg transition-colors"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              当前位置：
              {filteredMenuItems
                .find((m) => m.path === location.pathname)
                ?.label || '工作台'}
            </div>
            {currentUser && (
              <div className="text-sm text-slate-600">
                您好，<span className="font-medium text-blue-700">{currentUser.name}</span>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
