import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  BookOpen,
  Briefcase,
  Share2,
  BarChart3,
  GitBranch,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../store';

const navItems = [
  { path: '/', icon: Search, label: '审计工作台' },
  { path: '/dashboard', icon: LayoutDashboard, label: '风险仪表盘' },
  { path: '/fonts', icon: FileText, label: '字体库管理' },
  { path: '/licenses', icon: BookOpen, label: '授权证书' },
  { path: '/projects', icon: Briefcase, label: '项目管理' },
  { path: '/channels', icon: Share2, label: '发布渠道' },
  { path: '/reports', icon: BarChart3, label: '审计报告' },
  { path: '/regression', icon: GitBranch, label: '回归验证' }
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, currentRoute, setCurrentRoute } = useStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  if (currentRoute !== location.pathname) {
    setCurrentRoute(location.pathname);
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex">
      <aside
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } bg-[#0F2B4A] border-r border-slate-700/50 transition-all duration-300 flex flex-col relative`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
          {!sidebarCollapsed && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              字体授权审计
            </h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const isHovered = hoveredItem === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`
                  relative flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
                )}
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`} />
                {!sidebarCollapsed && (
                  <span className="ml-3 font-medium">{item.label}</span>
                )}
                {!sidebarCollapsed && isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto opacity-70" />
                )}
                {sidebarCollapsed && isHovered && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 rounded-lg shadow-xl text-sm whitespace-nowrap z-50 border border-slate-700">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-bold">
              法
            </div>
            {!sidebarCollapsed && (
              <div>
                <p className="text-sm font-medium">法务-李明</p>
                <p className="text-xs text-slate-400">管理员</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 bg-[#0F2B4A]/50 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-semibold">
              {navItems.find(n => n.path === currentRoute || currentRoute.startsWith(n.path))?.label || '字体授权审计'}
            </h2>
            <p className="text-xs text-slate-400">
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#E53935] rounded-full text-xs flex items-center justify-center">
                3
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-900">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
