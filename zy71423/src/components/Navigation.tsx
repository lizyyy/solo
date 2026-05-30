import { Home, Gamepad2, ListTodo, FileBarChart, Plus } from 'lucide-react';
import { Screen } from '../types';

interface NavigationProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onNewBatch: () => void;
  currentBatchId: string;
}

export const Navigation = ({
  currentScreen,
  onNavigate,
  onNewBatch,
  currentBatchId,
}: NavigationProps) => {
  const navItems: { screen: Screen; label: string; icon: typeof Home }[] = [
    { screen: 'home', label: '首页', icon: Home },
    { screen: 'game', label: '游戏', icon: Gamepad2 },
    { screen: 'records', label: '记录', icon: ListTodo },
    { screen: 'reports', label: '报告', icon: FileBarChart },
  ];

  return (
    <nav className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg font-orbitron">∫</span>
            </div>
            <div>
              <h1 className="text-white font-bold font-orbitron text-lg">函数怪兽躲避战</h1>
              <p className="text-xs text-slate-400">Function Monster Dodge</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.screen;
              return (
                <button
                  key={item.screen}
                  onClick={() => onNavigate(item.screen)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                    ${isActive
                      ? 'bg-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-500">当前批次</p>
              <p className="text-xs text-cyan-400 font-mono">{currentBatchId}</p>
            </div>
            <button
              onClick={onNewBatch}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              新批次
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
