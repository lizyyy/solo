import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { getLevelById } from '../data/levels';
import { TankSimulation } from '../components/game/TankSimulation';
import { ControlPanel } from '../components/game/ControlPanel';
import { QualityChart } from '../components/game/QualityChart';
import { ScoreBoard } from '../components/game/ScoreBoard';

export const Game: React.FC = () => {
  const navigate = useNavigate();
  const { levelId } = useParams<{ levelId: string }>();
  
  const {
    currentLevel,
    phase,
    round,
    maxRounds,
    score,
    totalCost,
    waterQuality,
    qualityHistory,
    successCount,
    insufficientStirringCount,
    overdoseCount,
    selectedChemicalAmount,
    selectedStirringTime,
    isProcessing,
    currentGameId,
    startGame,
    pauseGame,
    resumeGame,
    setSelectedChemicalAmount,
    setSelectedStirringTime,
    executeTreatment,
    nextRound,
    restartGame,
    resetToMenu
  } = useGameStore();

  useEffect(() => {
    if (levelId && !currentLevel) {
      const level = getLevelById(levelId);
      if (level) {
        startGame(level);
      } else {
        navigate('/');
      }
    }
  }, [levelId, currentLevel, startGame, navigate]);

  useEffect(() => {
    if (phase === 'ended' && currentGameId) {
      navigate(`/result/${currentGameId}`);
    }
  }, [phase, currentGameId, navigate]);

  const handleQuit = () => {
    resetToMenu();
    navigate('/');
  };

  if (!currentLevel) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const isPaused = phase === 'paused';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {isPaused && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-2xl p-8 text-center shadow-2xl border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6">游戏暂停</h2>
            <div className="space-y-3">
              <button
                onClick={resumeGame}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
              >
                继续游戏
              </button>
              <button
                onClick={restartGame}
                className="w-full py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-all"
              >
                重新开始
              </button>
              <button
                onClick={handleQuit}
                className="w-full py-3 bg-slate-700 text-slate-300 font-semibold rounded-lg hover:bg-red-600/30 hover:text-red-400 transition-all"
              >
                退出游戏
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 space-y-4">
            <ScoreBoard
              round={round}
              maxRounds={maxRounds}
              score={score}
              totalCost={totalCost}
              successCount={successCount}
              insufficientStirringCount={insufficientStirringCount}
              overdoseCount={overdoseCount}
              levelName={currentLevel.name}
            />
            <ControlPanel
              level={currentLevel}
              waterQuality={waterQuality}
              selectedChemicalAmount={selectedChemicalAmount}
              selectedStirringTime={selectedStirringTime}
              isProcessing={isProcessing}
              isPaused={isPaused}
              onChemicalChange={setSelectedChemicalAmount}
              onStirringChange={setSelectedStirringTime}
              onExecute={executeTreatment}
              onNextRound={nextRound}
              onPause={pauseGame}
              onResume={resumeGame}
              onRestart={restartGame}
              onQuit={handleQuit}
            />
          </div>

          <div className="col-span-5">
            <TankSimulation
              waterQuality={waterQuality}
              level={currentLevel}
              isProcessing={isProcessing}
              isStirring={selectedStirringTime > 0 && isProcessing}
            />
          </div>

          <div className="col-span-4">
            <QualityChart
              qualityHistory={qualityHistory}
              level={currentLevel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
