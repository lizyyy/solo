import React, { useEffect } from 'react';
import { ConsolePanel } from '../components/ConsolePanel';
import { CountdownTimer } from '../components/CountdownTimer';
import { ProblemArea } from '../components/ProblemArea';
import { JudgmentBanner } from '../components/JudgmentBanner';
import { Timeline } from '../components/Timeline';
import { SettlementModal } from '../components/SettlementModal';
import { NoteEditorModal } from '../components/NoteEditorModal';
import { useGameTimer } from '../hooks/useGameTimer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useGameStore } from '../store/useGameStore';

export const MainPage: React.FC = () => {
  const { loadLevel, currentLevelId, levels } = useGameStore();

  useGameTimer();
  useKeyboardShortcuts();

  useEffect(() => {
    if (!currentLevelId && levels.length > 0) {
      loadLevel(levels[0].id);
    }
  }, [currentLevelId, levels, loadLevel]);

  return (
    <div className="min-h-screen bg-industrial-bg text-industrial-text">
      <header className="border-b border-industrial-border bg-industrial-panel/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center text-xl font-bold shadow-lg shadow-amber-500/20">
                仓
              </div>
              <div>
                <h1 className="text-lg font-bold text-amber-400">期货仓单抢修队</h1>
                <p className="text-xs text-industrial-muted">科普馆教学演练工具</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-industrial-muted">讲解员</div>
              <div className="text-sm font-medium">小夏</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-100px)]">
          <div className="col-span-3 space-y-4 overflow-hidden flex flex-col">
            <CountdownTimer />
            <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
              <ConsolePanel />
            </div>
          </div>

          <div className="col-span-5 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              <ProblemArea />
            </div>
            <JudgmentBanner />
          </div>

          <div className="col-span-4 overflow-hidden">
            <Timeline />
          </div>
        </div>
      </main>

      <footer className="border-t border-industrial-border bg-industrial-panel/50 py-2 px-4 text-center text-xs text-industrial-muted">
        <span className="mr-4">📋 内置测试场景：空值处理 | 重复项去重 | 边界值判断 | 补录备注差异</span>
        <span>💡 点击"跑样例"可自动运行预录数据，验证判断引擎</span>
      </footer>

      <SettlementModal />
      <NoteEditorModal />
    </div>
  );
};
