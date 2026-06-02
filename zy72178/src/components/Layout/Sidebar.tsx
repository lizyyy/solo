import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Search,
  GitCompare,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/', label: '体检总览', icon: LayoutDashboard },
  { path: '/samples', label: '样本管理', icon: FileText },
  { path: '/compare', label: '版本对比', icon: GitCompare },
  { path: '/conflicts', label: '冲突清单', icon: AlertTriangle },
  { path: '/settings', label: '系统设置', icon: Settings },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, currentUser } = useAppStore();
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 260 : 72 }}
      className="fixed left-0 top-0 h-full bg-slate-900 text-white z-40 flex flex-col shadow-xl"
    >
      <div className="flex items-center h-16 px-4 border-b border-slate-700">
        <div className={cn(
          "flex items-center gap-3 overflow-hidden",
          sidebarOpen ? "w-auto" : "w-0"
        )}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-serif font-bold text-lg leading-tight">RAG体检</span>
            <span className="text-xs text-slate-400">知识库引用审核</span>
          </div>
        </div>
        {!sidebarOpen && (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                    isActive
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-900/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform",
                    isActive && "scale-110"
                  )} />
                  <motion.span
                    initial={false}
                    animate={{
                      opacity: sidebarOpen ? 1 : 0,
                      width: sidebarOpen ? 'auto' : 0,
                    }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                    />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-700 p-3">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2",
          !sidebarOpen && "justify-center"
        )}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-amber-400 to-accent-amber-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
            {currentUser.charAt(0)}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser}</p>
              <p className="text-xs text-slate-400">算法工程师</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
    </motion.aside>
  );
}
