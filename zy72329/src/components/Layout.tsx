import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  GitMerge,
  FileCheck,
  GitBranch,
  History,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { UserRole } from '../../shared/types';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: '整合结果', roles: ['admin', 'coach', 'reviewer'] as UserRole[] },
  { path: '/import', icon: Upload, label: '数据导入', roles: ['admin'] as UserRole[] },
  { path: '/conflicts', icon: GitMerge, label: '冲突处理', roles: ['coach'] as UserRole[] },
  { path: '/gaps', icon: FileCheck, label: '断档复核', roles: ['reviewer'] as UserRole[] },
  { path: '/versions', icon: GitBranch, label: '参数版本', roles: ['admin', 'coach', 'reviewer'] as UserRole[] },
  { path: '/history', icon: History, label: '历史记录', roles: ['admin', 'coach', 'reviewer'] as UserRole[] },
];

const roleLabels: Record<UserRole, string> = {
  admin: '行政老师',
  coach: '唐老师',
  reviewer: '教研组',
};

export default function Layout() {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleMenuItems = menuItems.filter((item) =>
    currentUser ? item.roles.includes(currentUser.role) : false
  );

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/login');
  };

  const handleSwitchRole = (_role: UserRole) => {
    setRoleMenuOpen(false);
  };

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={cn(
          'bg-slate-800 text-white transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          <div className={cn('flex items-center gap-2', !sidebarOpen && 'justify-center w-full')}>
            <Shield className="w-8 h-8 text-blue-400 flex-shrink-0" />
            {sidebarOpen && <span className="font-bold text-lg">稀疏矩阵账单压缩</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn('p-1 hover:bg-slate-700 rounded', !sidebarOpen && 'hidden')}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  'hover:bg-slate-700',
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300',
                  !sidebarOpen && 'justify-center'
                )
              }
              title={sidebarOpen ? undefined : item.label}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-700">
          {sidebarOpen && (
            <div className="text-xs text-gray-400 px-3 mb-2">当前角色</div>
          )}
          <button
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors',
              'text-gray-300',
              !sidebarOpen && 'justify-center'
            )}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && (
              <>
                <span className="flex-1 text-left">{roleLabels[currentUser.role]}</span>
                <ChevronDown
                  className={cn('w-4 h-4 transition-transform', roleMenuOpen && 'rotate-180')}
                />
              </>
            )}
          </button>
          {roleMenuOpen && sidebarOpen && (
            <div className="mt-1 space-y-1">
              {(['admin', 'coach', 'reviewer'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => handleSwitchRole(role)}
                  className={cn(
                    'w-full text-left px-6 py-2 rounded-lg text-sm transition-colors',
                    currentUser.role === role
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-slate-700'
                  )}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 hidden md:block">
              账单证据整合与审核
            </h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {currentUser.name}
              </span>
              <ChevronDown
                className={cn('w-4 h-4 text-gray-500 transition-transform', userMenuOpen && 'rotate-180')}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-800">{currentUser.name}</p>
                  <p className="text-xs text-gray-500">{roleLabels[currentUser.role]}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
