import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Clock, AlertTriangle, Download, PlayCircle } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { COACHES } from '../types';

const navItems = [
  { path: '/', label: '仿真控制台', icon: LayoutDashboard },
  { path: '/drafts', label: '草稿版本', icon: FileText },
  { path: '/timeline', label: '时间线回看', icon: Clock },
  { path: '/anomalies', label: '异常中心', icon: AlertTriangle },
  { path: '/export', label: '导出中心', icon: Download },
];

export function Navbar() {
  const location = useLocation();
  const { currentUser, setCurrentUser, isRunning, simulationTime } = useSimulationStore();

  const currentCoach = COACHES.find((c) => c.id === currentUser);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <PlayCircle className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-slate-100">排队窗口仿真</span>
            </div>

            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-amber-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isRunning && (
              <div className="flex items-center space-x-2 text-sm font-mono">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-400">运行中</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300">{formatTime(simulationTime)}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-400">当前教练:</span>
              <select
                value={currentUser}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {COACHES.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
