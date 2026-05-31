import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, PlusCircle, AlertTriangle, FileText, Clock } from 'lucide-react';
import { usePowerBudgetStore } from '../store/usePowerBudgetStore';
import { TimeSystem } from '../types';
import { getTimeSystemLabel } from '../utils/timeConverter';

const navItems = [
  { path: '/calendar', label: '日历视图', icon: Calendar },
  { path: '/entry', label: '数据录入', icon: PlusCircle },
  { path: '/anomaly', label: '异常分析', icon: AlertTriangle },
  { path: '/briefing', label: '任务简报', icon: FileText },
];

const timeSystems: TimeSystem[] = ['UTC', 'TAI', 'BEIJING'];

export const Layout: React.FC = () => {
  const { displayTimeSystem, setDisplayTimeSystem, viewMode, exitSnapshotMode, selectedSnapshotId } = usePowerBudgetStore();

  return (
    <div className="min-h-screen bg-console-bg text-console-text font-sans">
      {viewMode === 'snapshot' && (
        <div className="bg-eng-yellow/20 border-b border-eng-yellow px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-eng-yellow" />
            <span className="text-eng-yellow">当前正在查看历史快照</span>
            {selectedSnapshotId && (
              <span className="text-console-muted font-mono text-xs">
                ID: {selectedSnapshotId.substring(0, 16)}...
              </span>
            )}
          </div>
          <button
            onClick={exitSnapshotMode}
            className="px-3 py-1 text-xs bg-eng-yellow text-console-bg rounded hover:bg-eng-yellow/80 transition-colors"
          >
            退出快照模式
          </button>
        </div>
      )}
      
      <div className="flex">
        <aside className="w-56 min-h-screen bg-console-panel border-r border-console-border flex flex-col">
          <div className="p-4 border-b border-console-border">
            <h1 className="text-lg font-bold text-console-text">电源预算日历</h1>
            <p className="text-xs text-console-muted mt-1">Power Budget Calendar</p>
          </div>
          
          <nav className="flex-1 p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded mb-1 transition-colors ${
                    isActive
                      ? 'bg-eng-blue/20 text-eng-blue-light border-l-2 border-eng-blue'
                      : 'text-console-muted hover:bg-console-bg hover:text-console-text'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="p-4 border-t border-console-border">
            <label className="text-xs text-console-muted mb-2 block">显示时间制</label>
            <div className="flex gap-1">
              {timeSystems.map((ts) => (
                <button
                  key={ts}
                  onClick={() => setDisplayTimeSystem(ts)}
                  className={`flex-1 px-2 py-1.5 text-xs font-mono rounded border transition-colors ${
                    displayTimeSystem === ts
                      ? 'bg-eng-blue/20 border-eng-blue text-eng-blue-light'
                      : 'border-console-border text-console-muted hover:border-console-muted'
                  }`}
                  title={getTimeSystemLabel(ts)}
                >
                  {ts}
                </button>
              ))}
            </div>
          </div>
        </aside>
        
        <main className="flex-1 min-h-screen overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
