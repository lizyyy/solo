import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Home, RotateCcw } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import QueuePanel from '../components/QueuePanel';
import SecurityStation from '../components/SecurityStation';
import StatusMonitor from '../components/StatusMonitor';
import EventLog from '../components/EventLog';
import GameOverModal from '../components/GameOverModal';
import { scoringEngine } from '../game/scoringEngine';

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    phase,
    normalChannelQueue,
    vipChannelQueue,
    currentAudience,
    isScanning,
    scanProgress,
    scanResult,
    remainingTime,
    totalDuration,
    events,
    stats,
    scores,
    finalScore,
    pendingReviewCount,
    tick,
    pauseGame,
    resumeGame,
    resetGame,
    startScan,
    passAudience,
    blockAudience
  } = useGameStore();

  useEffect(() => {
    if (phase === 'idle') {
      navigate('/');
    }
  }, [phase, navigate]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase, tick]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (phase !== 'playing') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (!isScanning && scanResult === 'idle') {
          startScan();
        }
        break;
      case 'KeyF':
        if (!isScanning && scanResult !== 'idle') {
          passAudience();
        }
        break;
      case 'KeyG':
        if (!isScanning && scanResult !== 'idle') {
          blockAudience();
        }
        break;
      case 'Escape':
        pauseGame();
        break;
    }
  }, [phase, isScanning, scanResult, startScan, passAudience, blockAudience, pauseGame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBackHome = () => {
    resetGame();
    navigate('/');
  };

  if (phase === 'ended') {
    const rating = scoringEngine.getScoreRating(finalScore);
    return (
      <GameOverModal
        score={finalScore}
        rating={rating}
        scores={scores}
        stats={stats}
        events={events}
        onReplay={() => navigate(`/replay/${useGameStore.getState().sessionId}`)}
        onReport={() => navigate(`/report/${useGameStore.getState().sessionId}`)}
        onRestart={handleBackHome}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-navy-900">
      <header className="h-14 px-4 flex items-center justify-between border-b border-navy-700 bg-navy-800/50">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg">🎫 演唱会安检排队局</h1>
          <span className="text-xs bg-navy-700 px-2 py-1 rounded">
            {useGameStore.getState().difficulty === 'easy' ? '简单' : 
             useGameStore.getState().difficulty === 'normal' ? '普通' : '困难'}模式
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={phase === 'playing' ? pauseGame : resumeGame}
            className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <Pause className="w-5 h-5" />
          </button>
          <button
            onClick={handleBackHome}
            className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          <div className="col-span-3 bg-navy-800/30 rounded-2xl border border-navy-700 overflow-hidden">
            <QueuePanel
              normalQueue={normalChannelQueue}
              vipQueue={vipChannelQueue}
            />
          </div>

          <div className="col-span-5 bg-navy-800/30 rounded-2xl border border-navy-700 overflow-hidden">
            <SecurityStation
              audience={currentAudience}
              isScanning={isScanning}
              scanProgress={scanProgress}
              scanResult={scanResult}
            />
          </div>

          <div className="col-span-4 flex flex-col gap-4">
            <div className="flex-1 bg-navy-800/30 rounded-2xl border border-navy-700 overflow-hidden">
              <StatusMonitor
                remainingTime={remainingTime}
                totalDuration={totalDuration}
                stats={stats}
                scores={scores}
                pendingReview={pendingReviewCount}
              />
            </div>
            <div className="h-64 bg-navy-800/30 rounded-2xl border border-navy-700 overflow-hidden">
              <EventLog events={events} />
            </div>
          </div>
        </div>
      </main>

      {phase === 'paused' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-navy-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-navy-600">
            <h2 className="text-2xl font-bold text-center mb-6">游戏暂停</h2>
            <div className="space-y-3">
              <button
                onClick={resumeGame}
                className="w-full py-3 bg-success hover:bg-success/80 rounded-xl font-medium transition-colors"
              >
                继续游戏
              </button>
              <button
                onClick={handleBackHome}
                className="w-full py-3 bg-navy-700 hover:bg-navy-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                返回主页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;
