import { Outlet, NavLink } from 'react-router-dom';
import { useSimulationStore } from '@/store/useSimulationStore';
import { useUIStore } from '@/store/useUIStore';
import { BarChart3, Settings, Database, Box, ChevronLeft, ChevronRight, AlertTriangle, Plus } from 'lucide-react';

const navItems = [
  { to: '/', icon: Box, label: '3D场景' },
  { to: '/parameters', icon: Settings, label: '参数配置' },
  { to: '/analysis', icon: BarChart3, label: '数据分析' },
  { to: '/data-manager', icon: Database, label: '数据管理' },
];

export default function AppLayout() {
  const { sidebarOpen, toggleSidebar, showExplanation, setShowExplanation, notifications, removeNotification } = useUIStore();
  const { currentSimulation, createNewSimulation } = useSimulationStore();
  const anomalyCount = currentSimulation?.anomalies.filter(a => !a.isConfirmed).length ?? 0;

  const handleCreateSimulation = () => {
    createNewSimulation(`模拟 ${Date.now()}`, '当前用户');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-primary-900">
      <aside
        className={`flex flex-col border-r border-primary-700/30 bg-primary-900 transition-all duration-300 ${
          sidebarOpen ? 'w-[200px]' : 'w-[60px]'
        }`}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b border-primary-700/30">
          {sidebarOpen && <span className="text-sm font-semibold text-white font-display">能量分析</span>}
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-2 space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Icon size={20} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-primary-700/30 p-2">
          {sidebarOpen && (
            <button
              onClick={handleCreateSimulation}
              className="btn-accent flex w-full items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} />
              新建模拟
            </button>
          )}
          {!sidebarOpen && (
            <button
              onClick={handleCreateSimulation}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-400 hover:bg-accent-300 text-white mx-auto transition-colors"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-primary-700/30 bg-primary-900 px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-white font-display">
              {currentSimulation?.name ?? '未创建模拟'}
            </h1>
            {currentSimulation && (
              <span className="text-xs text-primary-300 bg-primary-800 px-2 py-0.5 rounded">
                {currentSimulation.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                showExplanation
                  ? 'bg-accent-400/20 text-accent-400 border border-accent-400/30'
                  : 'bg-primary-800 text-primary-200 hover:text-white border border-primary-600/30'
              }`}
            >
              <BarChart3 size={14} />
              解释面板
            </button>

            {anomalyCount > 0 && (
              <button className="flex items-center gap-1.5 rounded-lg bg-danger-500/20 border border-danger-500/30 px-3 py-1.5 text-xs font-medium text-danger-400">
                <AlertTriangle size={14} />
                {anomalyCount} 异常
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2 border-t border-primary-700/30 bg-primary-800/80 px-4 py-2">
            {notifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                  n.type === 'success'
                    ? 'bg-success-500/20 text-success-400'
                    : n.type === 'warning'
                    ? 'bg-warning-500/20 text-warning-400'
                    : n.type === 'error'
                    ? 'bg-danger-500/20 text-danger-400'
                    : 'bg-primary-600/20 text-primary-200'
                }`}
              >
                <span className="font-medium">{n.title}</span>
                <span className="text-primary-300">{n.message}</span>
                <button onClick={() => removeNotification(n.id)} className="ml-1 text-primary-400 hover:text-white">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
