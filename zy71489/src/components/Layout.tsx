import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Music,
  Workflow,
  Upload,
  History,
  BarChart3,
  Clock,
  Users,
  Zap,
  AlertTriangle,
  Menu,
  X,
  Disc3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: '决策工作台', icon: <Workflow size={18} /> },
  { path: '/import', label: '数据导入', icon: <Upload size={18} /> },
  { path: '/audit', label: '审计追溯', icon: <History size={18} /> },
];

const mockSidebarStats = {
  currentDecision: '2024夏季巡演返场',
  trackCount: 156,
  voteCount: 12847,
  avgStamina: 3.2,
  copyrightRisk: 3,
  lastUpdate: '2024-05-20 14:30'
};

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="h-16 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stage bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center border border-gold/40">
            <Disc3 className="text-gold" size={22} />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-gold leading-none">返场曲单决策系统</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Encore Decision System</p>
          </div>
        </div>

        <nav className="flex-1 flex items-center justify-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'px-4 py-2 rounded-stage flex items-center gap-2 transition-all duration-300',
                  isActive
                    ? 'bg-gold/15 text-gold border border-gold/40 shadow-glow'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50 border border-transparent'
                )
              }
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-white font-medium">演出经纪人</p>
            <p className="text-xs text-neutral-500">admin@venue.com</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/40 to-gold/20 flex items-center justify-center border border-gold/40">
            <Users size={18} className="text-gold" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            'border-r border-neutral-800 bg-neutral-900/50 transition-all duration-300 flex flex-col',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                当前决策
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              {sidebarCollapsed ? <Menu size={16} /> : <X size={16} />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="p-4 space-y-4 animate-fade-in-up">
              <div>
                <p className="text-xs text-neutral-500 mb-1">决策名称</p>
                <p className="text-sm font-medium text-gold">{mockSidebarStats.currentDecision}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Music size={14} />
                    <span className="text-xs">候选曲目</span>
                  </div>
                  <span className="font-mono text-sm text-white">{mockSidebarStats.trackCount}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <BarChart3 size={14} />
                    <span className="text-xs">总投票数</span>
                  </div>
                  <span className="font-mono text-sm text-gold">{mockSidebarStats.voteCount.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Zap size={14} />
                    <span className="text-xs">平均体力</span>
                  </div>
                  <span className="font-mono text-sm text-white">{mockSidebarStats.avgStamina}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <AlertTriangle size={14} />
                    <span className="text-xs">版权风险</span>
                  </div>
                  <span className="font-mono text-sm text-red animate-pulse-red">
                    {mockSidebarStats.copyrightRisk} 项
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Clock size={12} />
                  <span className="text-xs">最后更新</span>
                </div>
                <p className="font-mono text-xs text-neutral-400 mt-1">{mockSidebarStats.lastUpdate}</p>
              </div>
            </div>
          )}

          {sidebarCollapsed && (
            <div className="flex-1 flex flex-col items-center py-4 gap-4">
              <Music size={18} className="text-neutral-500" />
              <BarChart3 size={18} className="text-neutral-500" />
              <Zap size={18} className="text-neutral-500" />
              <AlertTriangle size={18} className="text-red animate-pulse-red" />
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
