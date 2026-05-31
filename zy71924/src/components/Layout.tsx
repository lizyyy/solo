import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ClipboardList, 
  AlertCircle, 
  FileDown, 
  Menu, 
  X,
  Sparkles
} from 'lucide-react';
import { useStore } from '../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { getStatistics, currentUser } = useStore();
  const stats = getStatistics();

  const navItems = [
    { 
      path: '/', 
      label: '巡检记录', 
      icon: ClipboardList,
      badge: null
    },
    { 
      path: '/pending', 
      label: '待处理中心', 
      icon: AlertCircle,
      badge: stats.pending + stats.abnormal
    },
    { 
      path: '/export', 
      label: '导出与设置', 
      icon: FileDown,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="flex h-screen overflow-hidden">
        <aside 
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } transition-all duration-300 ease-in-out bg-slate-900 text-white flex flex-col overflow-hidden`}
        >
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                  装置灯光巡检
                </h1>
                <p className="text-xs text-slate-400">画廊布展管理系统</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-slate-800 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== null && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-rose-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center text-sm font-medium">
                {currentUser.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser}</p>
                <p className="text-xs text-slate-500">当前用户</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600">正常 {stats.normal}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600">待处理 {stats.pending}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-slate-600">异常 {stats.abnormal}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
