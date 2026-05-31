import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  FileText,
  ClipboardList,
  Wrench,
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  Bell,
  Gauge,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useRecordsStore } from '@/stores/recordsStore';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '数据看板', icon: LayoutDashboard },
  { path: '/pulse-analysis', label: '脉冲分析', icon: Activity },
  { path: '/records/shift', label: '班组记录', icon: FileText },
  { path: '/records/logs', label: '工况日志', icon: ClipboardList },
  { path: '/records/maintenance', label: '维修单', icon: Wrench },
  { path: '/history', label: '历史追溯', icon: History },
  { path: '/export', label: '报告导出', icon: Download },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, currentUser, showNotificationPanel, setShowNotificationPanel } = useUIStore();
  const { notifications } = useRecordsStore();

  const unreadCount = notifications.length;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-industrial-bg border-r border-industrial-border transition-all duration-300 z-40 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-industrial-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Gauge className="w-8 h-8 text-signal-green" />
            <span className="font-bold text-lg text-industrial-text">管线压力脉冲</span>
          </div>
        )}
        {sidebarCollapsed && <Gauge className="w-8 h-8 text-signal-green mx-auto" />}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 group',
                    isActive
                      ? 'bg-tech-blue/20 text-tech-blue border-l-2 border-tech-blue'
                      : 'text-industrial-text-muted hover:bg-industrial-bg-lighter hover:text-industrial-text',
                    sidebarCollapsed && 'justify-center'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isActive && 'text-tech-blue'
                  )} />
                  {!sidebarCollapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.path === '/' && unreadCount > 0 && (
                    <span className="ml-auto flex items-center justify-center w-5 h-5 bg-danger-red text-white text-xs rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {!sidebarCollapsed && currentUser && (
        <div className="p-4 border-t border-industrial-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tech-blue/20 flex items-center justify-center text-tech-blue font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-industrial-text truncate">{currentUser.name}</p>
              <p className="text-xs text-industrial-text-muted truncate">{currentUser.employeeNo}</p>
            </div>
            <button
              onClick={() => setShowNotificationPanel(!showNotificationPanel)}
              className="relative p-2 hover:bg-industrial-bg-lighter rounded transition-colors"
            >
              <Bell className="w-5 h-5 text-industrial-text-muted" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger-red rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={toggleSidebar}
        className="absolute top-1/2 -right-3 w-6 h-6 bg-industrial-bg-lighter border border-industrial-border rounded-full flex items-center justify-center text-industrial-text-muted hover:text-industrial-text transition-colors shadow-industrial"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
};
