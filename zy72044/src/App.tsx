import { useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/useGameStore';
import ControlPanel from '@/components/ControlPanel';
import Dashboard from '@/components/Dashboard';
import EventLog from '@/components/EventLog';
import PlaybackBar from '@/components/PlaybackBar';
import ReportPanel from '@/components/ReportPanel';
import ConfigValidator from '@/components/ConfigValidator';
import { FileText, Gamepad2, X, AlertTriangle } from 'lucide-react';

export default function App() {
  const {
    appView,
    setAppView,
    engineState,
    errorMessages,
    dismissError,
    currentConfig,
    stepEvent,
  } = useGameStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (appView !== 'game') return;
      if (engineState.status === 'running' && e.key === ' ') {
        e.preventDefault();
        stepEvent();
      }
    },
    [appView, engineState.status, stepEvent]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isRunning = engineState.status === 'running';
  const isPaused = engineState.status === 'paused';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🚦</span>
              <h1 className="text-base font-semibold text-slate-100">城市绿波信号赛</h1>
            </div>
            {currentConfig && (
              <span className="text-xs text-slate-500 px-2 py-0.5 rounded-full bg-slate-800/60">
                {currentConfig.name}
              </span>
            )}
          </div>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setAppView('game')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                appView === 'game'
                  ? 'bg-emerald-600/20 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Gamepad2 size={14} /> 比赛
            </button>
            <button
              onClick={() => setAppView('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                appView === 'report'
                  ? 'bg-emerald-600/20 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileText size={14} /> 报告
            </button>
          </nav>
        </div>
      </header>

      {errorMessages.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4 space-y-2">
          {errorMessages.map((msg, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-red-950/40 border border-red-700/30 rounded-lg"
            >
              <div className="flex items-center gap-2 text-red-300 text-sm">
                <AlertTriangle size={14} /> {msg}
              </div>
              <button
                onClick={() => dismissError(i)}
                className="text-red-400 hover:text-red-300"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {appView === 'game' && (
          <div className="space-y-4">
            <ConfigValidator />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3 space-y-4">
                <ControlPanel />
              </div>
              <div className="lg:col-span-9 space-y-4">
                <Dashboard />
                <EventLog />
              </div>
            </div>
            {(isRunning || isPaused) && (
              <div className="fixed bottom-4 right-4 z-30">
                <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl px-4 py-2 shadow-xl">
                  <span className="text-xs text-slate-400">空格键推进一步</span>
                  <kbd className="px-2 py-0.5 text-xs bg-slate-700 rounded text-slate-300">Space</kbd>
                </div>
              </div>
            )}
          </div>
        )}

        {appView === 'report' && <ReportPanel />}
      </main>

      {appView === 'replay' && <PlaybackBar />}
    </div>
  );
}
