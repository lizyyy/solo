import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, ChevronLeft, ChevronRight, Film } from 'lucide-react';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const taskIdMatch = location.pathname.match(/\/task\/([^/]+)/);
  const taskId = taskIdMatch?.[1];

  return (
    <div className="flex h-screen bg-zinc-50">
      <aside
        className="flex flex-col transition-all duration-300"
        style={{ width: collapsed ? 64 : 220, backgroundColor: '#1e3a5f' }}
      >
        <div className="flex items-center h-16 px-4 border-b border-white/10">
          <Film className="text-white shrink-0" size={24} />
          {!collapsed && <span className="ml-3 text-white font-semibold text-lg whitespace-nowrap">分账核对</span>}
        </div>
        <nav className="flex-1 py-4">
          <button
            onClick={() => navigate('/')}
            className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors ${
              location.pathname === '/'
                ? 'bg-white/15 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} className="shrink-0" />
            {!collapsed && <span className="ml-3 whitespace-nowrap">任务列表</span>}
          </button>
        </nav>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 border-t border-white/10 text-white/60 hover:text-white hover:bg-white/10"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {taskId && (
          <header className="h-14 flex items-center px-6 bg-white border-b border-zinc-200 shrink-0">
            <button onClick={() => navigate('/')} className="text-sm text-zinc-500 hover:text-zinc-700 mr-2">
              任务列表
            </button>
            <span className="text-sm text-zinc-400 mr-2">/</span>
            <span className="text-sm font-medium text-zinc-800 truncate">
              {location.pathname.includes('/history') ? '历史记录' : '任务详情'}
            </span>
          </header>
        )}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
