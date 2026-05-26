import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { levels } from '@/data/levels';
import { loadGameHistory, clearGameHistory } from '@/utils/storage';
import { exportToJSON, copyToClipboard, generateReport } from '@/utils/export';
import { GameHistory, Level } from '@/types/game';
import MainMenu from '@/components/MainMenu';
import GamePage from './GamePage';
import Settlement from '@/components/Settlement';
import Replay from '@/components/Replay';

export default function Home() {
  const {
    gamePhase,
    isWin,
    failureReason,
    scoreBreakdown,
    currentHistory,
    turnHistory,
    level,
    score,
    currentTurn,
    replayHistory,
    replayTurnIndex,
    startGame,
    restartGame,
    goToMenu,
    startReplay,
    setReplayTurn,
    exitReplay,
  } = useGameStore();

  const [history, setHistory] = useState<GameHistory[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(loadGameHistory());
  }, [gamePhase]);

  const handleStartGame = useCallback((selectedLevel: Level) => {
    startGame(selectedLevel);
  }, [startGame]);

  const handleStartReplay = useCallback((historyId: string) => {
    startReplay(historyId);
  }, [startReplay]);

  const handleClearHistory = useCallback(() => {
    if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      clearGameHistory();
      setHistory([]);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (currentHistory && scoreBreakdown) {
      const report = {
        summary: {
          gameId: currentHistory.id,
          timestamp: currentHistory.timestamp,
          levelName: currentHistory.levelName,
          isWin: currentHistory.isWin,
          finalScore: currentHistory.finalScore,
          failureReason: currentHistory.failureReason,
          totalTurns: currentHistory.totalTurns,
          maxTurns: currentHistory.maxTurns,
        },
        scoreBreakdown,
        turnDetails: currentHistory.turns,
      };
      exportToJSON(report, `report_${currentHistory.id}`);
    }
  }, [currentHistory, scoreBreakdown]);

  const handleCopyReport = useCallback(async () => {
    if (currentHistory && scoreBreakdown) {
      const reportText = generateReport(currentHistory, scoreBreakdown);
      const success = await copyToClipboard(reportText);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [currentHistory, scoreBreakdown]);

  const handleExportReplay = useCallback(() => {
    if (replayHistory) {
      exportToJSON(replayHistory, `replay_${replayHistory.id}`);
    }
  }, [replayHistory]);

  const handleReplayTurnChange = useCallback((index: number) => {
    setReplayTurn(index);
  }, [setReplayTurn]);

  if (gamePhase === 'menu') {
    return (
      <MainMenu
        levels={levels}
        history={history}
        onStartGame={handleStartGame}
        onStartReplay={handleStartReplay}
        onClearHistory={handleClearHistory}
      />
    );
  }

  if (gamePhase === 'playing') {
    return <GamePage />;
  }

  if (gamePhase === 'settlement' && currentHistory && scoreBreakdown) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Settlement
            isWin={isWin}
            failureReason={failureReason}
            levelName={currentHistory.levelName}
            finalScore={currentHistory.finalScore}
            totalTurns={currentHistory.totalTurns}
            maxTurns={currentHistory.maxTurns}
            scoreBreakdown={scoreBreakdown}
            history={currentHistory}
            onBack={goToMenu}
            onRestart={restartGame}
            onExport={handleExport}
            onCopyReport={handleCopyReport}
            turns={turnHistory}
            copied={copied}
          />
        </div>
      </div>
    );
  }

  if (gamePhase === 'replay' && replayHistory) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto">
          <Replay
            history={replayHistory}
            currentTurnIndex={replayTurnIndex}
            onTurnChange={handleReplayTurnChange}
            onExit={exitReplay}
            onExport={handleExportReplay}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-400">加载中...</div>
    </div>
  );
}
