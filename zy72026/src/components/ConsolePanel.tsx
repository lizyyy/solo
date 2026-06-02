import React, { useState } from 'react';
import { Play, Pause, RotateCcw, FileText, StickyNote, FastForward, Rewind } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { levels } from '../data/levels';

export const ConsolePanel: React.FC = () => {
  const {
    session,
    currentLevelId,
    loadLevel,
    startSession,
    pauseSession,
    resumeSession,
    restartSession,
    settleSession,
    setShowNoteEditor,
    runPreRecorded,
    startReplay,
    replayMode,
    exitReplay,
  } = useGameStore();

  const [isRunningDemo, setIsRunningDemo] = useState(false);

  const statusLabels: Record<string, { text: string; class: string }> = {
    idle: { text: '待命', class: 'status-idle' },
    running: { text: '运行中', class: 'status-running' },
    paused: { text: '已暂停', class: 'status-paused' },
    completed: { text: '已完成', class: 'status-completed' },
  };

  const status = session ? statusLabels[session.status] : statusLabels.idle;

  const handleRunDemo = () => {
    if (session?.status === 'idle') {
      startSession();
      setIsRunningDemo(true);
      setTimeout(() => {
        runPreRecorded();
        setIsRunningDemo(false);
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="industrial-panel p-4">
        <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          控制台
        </h2>

        <div className="mb-4">
          <label className="block text-sm text-industrial-muted mb-2">选择关卡</label>
          <select
            value={currentLevelId || ''}
            onChange={(e) => loadLevel(e.target.value)}
            disabled={session?.status === 'running' || isRunningDemo}
            className="w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-industrial-text focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
          {levels.find((l) => l.id === currentLevelId) && (
            <p className="text-xs text-industrial-muted mt-1">
              {levels.find((l) => l.id === currentLevelId)?.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4 p-3 bg-industrial-bg rounded-lg">
          <span className={`status-indicator ${status.class}`} />
          <span className="text-sm">状态：</span>
          <span className="font-semibold">{status.text}</span>
        </div>

        {session && (
          <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
            <div className="bg-industrial-bg p-2 rounded text-center">
              <div className="text-industrial-muted text-xs">当前得分</div>
              <div className="font-mono text-xl font-bold text-amber-400">{session.score}</div>
            </div>
            <div className="bg-industrial-bg p-2 rounded text-center">
              <div className="text-industrial-muted text-xs">已完成</div>
              <div className="font-mono text-xl font-bold text-emerald-400">
                {Object.keys(session.judgments).length}/{levels.find((l) => l.id === currentLevelId)?.problems.length || 0}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {session?.status === 'idle' && (
            <>
              <button
                onClick={startSession}
                className="industrial-button-primary flex items-center justify-center gap-2"
              >
                <Play size={18} />
                开始
              </button>
              <button
                onClick={handleRunDemo}
                disabled={isRunningDemo}
                className="industrial-button-info flex items-center justify-center gap-2"
              >
                <FastForward size={18} />
                跑样例
              </button>
            </>
          )}

          {session?.status === 'running' && (
            <>
              <button
                onClick={pauseSession}
                className="industrial-button-secondary flex items-center justify-center gap-2"
              >
                <Pause size={18} />
                暂停
              </button>
              <button
                onClick={restartSession}
                className="industrial-button-info flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                重开
              </button>
            </>
          )}

          {session?.status === 'paused' && (
            <>
              <button
                onClick={resumeSession}
                className="industrial-button-primary flex items-center justify-center gap-2"
              >
                <Play size={18} />
                继续
              </button>
              <button
                onClick={restartSession}
                className="industrial-button-info flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                重开
              </button>
            </>
          )}

          {(session?.status === 'running' || session?.status === 'paused') && (
            <button
              onClick={settleSession}
              className="industrial-button-danger flex items-center justify-center gap-2 col-span-2"
            >
              <FileText size={18} />
              结算
            </button>
          )}

          {(session?.status === 'completed' || session?.status === 'idle') && (
            <>
              <button
                onClick={restartSession}
                className="industrial-button-info flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                {session?.status === 'completed' ? '再来一次' : '重置'}
              </button>
              {session?.status === 'completed' && session.events.length > 0 && (
                <button
                  onClick={startReplay}
                  className="industrial-button-secondary flex items-center justify-center gap-2"
                >
                  <Rewind size={18} />
                  回放
                </button>
              )}
            </>
          )}
        </div>

        {(session?.status === 'running' || session?.status === 'paused') && (
          <button
            onClick={() => setShowNoteEditor(true)}
            className="w-full mt-2 industrial-button-secondary flex items-center justify-center gap-2"
          >
            <StickyNote size={16} />
            补录备注
          </button>
        )}
      </div>

      <div className="industrial-panel p-4">
        <h3 className="text-sm font-semibold text-industrial-muted mb-2">⌨️ 快捷键</h3>
        <ul className="text-xs text-industrial-muted space-y-1">
          <li><kbd className="px-1.5 py-0.5 bg-industrial-bg rounded text-amber-400">空格</kbd> 开始/暂停/继续</li>
          <li><kbd className="px-1.5 py-0.5 bg-industrial-bg rounded text-amber-400">1-3</kbd> 选择操作</li>
          <li><kbd className="px-1.5 py-0.5 bg-industrial-bg rounded text-amber-400">Ctrl+R</kbd> 重开</li>
        </ul>
      </div>
    </div>
  );
};
