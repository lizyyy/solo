import { NavLink, useLocation } from 'react-router-dom';
import {
  MapPin,
  FileUp,
  AlertTriangle,
  GitCompare,
  ClipboardCheck,
  Waves,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const navItems = [
  { path: '/', label: '预警总览', icon: MapPin, description: '空间分布' },
  { path: '/import', label: '材料导入', icon: FileUp, description: '上传数据' },
  { path: '/anomalies', label: '异常检测', icon: AlertTriangle, description: '问题清单' },
  { path: '/compare', label: '版本对比', icon: GitCompare, description: '口径追溯' },
  { path: '/review', label: '复核汇总', icon: ClipboardCheck, description: '证据管理' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, anomalies } = useAppStore();
  const location = useLocation();

  const pendingCount = anomalies.filter(a => a.status === 'pending').length;

  return (
    <aside
      className={`h-screen bg-ocean-900 text-white flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-ocean-700/50">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Waves className="w-6 h-6 text-ocean-300" />
            <span className="font-serif text-lg font-semibold tracking-wide">海洋牧场</span>
          </div>
        )}
        {sidebarCollapsed && (
          <Waves className="w-6 h-6 text-ocean-300 mx-auto" />
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const showBadge = item.path === '/anomalies' && pendingCount > 0;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 mx-2 px-3 py-2.5 rounded-md
                transition-all duration-200 group relative
                ${isActive
                  ? 'bg-ocean-700/60 text-white shadow-inner'
                  : 'text-ocean-200 hover:bg-ocean-800/60 hover:text-white'
                }
              `}
            >
              <div className="relative flex-shrink-0">
                <Icon className={`w-5 h-5 ${isActive ? 'text-ocean-300' : 'text-ocean-400 group-hover:text-ocean-300'}`} />
                {showBadge && !sidebarCollapsed && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-alert-orange text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
                {showBadge && sidebarCollapsed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-alert-orange rounded-full" />
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  <span className="text-xs text-ocean-400 truncate">{item.description}</span>
                </div>
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-ocean-400 rounded-r" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-2 border-t border-ocean-700/50">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-2 text-ocean-400 hover:text-white hover:bg-ocean-800/60 rounded-md transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm ml-2">收起侧栏</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
