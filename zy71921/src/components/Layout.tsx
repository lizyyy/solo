import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Clock,
  AlertTriangle,
  Download,
  Menu,
  X,
  Package,
} from 'lucide-react';
import { useHandoverStore } from '@/store/useHandoverStore';
import { HANDOVER_STATUS_LABELS } from '@/types';

const navItems = [
  { path: '/dashboard', label: '交接工作台', icon: LayoutDashboard },
  { path: '/materials', label: '材料管理', icon: FileText },
  { path: '/timeline', label: '状态回看', icon: Clock },
  { path: '/exceptions', label: '异常中心', icon: AlertTriangle },
  { path: '/export', label: '导出中心', icon: Download },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { getCurrentHandover, getExceptionsForHandover } = useHandoverStore();
  
  const currentHandover = getCurrentHandover();
  const openExceptions = currentHandover 
    ? getExceptionsForHandover(currentHandover.id).filter(e => e.status === 'open').length
    : 0;

  return (
    <div className="min-h-screen bg-gallery-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-gallery-900 text-white transition-all duration-300 overflow-hidden flex-shrink-0`}
      >
        <div className="p-6 border-b border-gallery-700">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-accent-warning" />
            <div>
              <h1 className="font-bold text-lg">雕塑运输交接</h1>
              <p className="text-xs text-gallery-400">画廊助理工作台</p>
            </div>
          </div>
        </div>

        {currentHandover && (
          <div className="p-4 border-b border-gallery-700">
            <div className="text-xs text-gallery-400 mb-1">当前交接单</div>
            <div className="font-medium truncate">{currentHandover.title}</div>
            <div className="text-xs text-gallery-400 mt-1">
              状态: 
              <span className="ml-1 text-accent-warning">
                {HANDOVER_STATUS_LABELS[currentHandover.status]}
              </span>
            </div>
          </div>
        )}

        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const showBadge = item.path === '/exceptions' && openExceptions > 0;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded transition-all ${
                      isActive
                        ? 'bg-gallery-700 text-white'
                        : 'text-gallery-300 hover:bg-gallery-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                    {showBadge && (
                      <span className="ml-auto bg-accent-danger text-white text-xs px-2 py-0.5 rounded-full">
                        {openExceptions}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gallery-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gallery-100 rounded transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">
            {openExceptions > 0 && (
              <div className="flex items-center gap-2 text-sm text-accent-warning bg-amber-50 px-3 py-1.5 rounded">
                <AlertTriangle className="w-4 h-4" />
                <span>{openExceptions} 个待处理异常</span>
              </div>
            )}
            <div className="text-sm text-gallery-600">
              操作人: <span className="font-medium text-gallery-900">画廊助理</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
