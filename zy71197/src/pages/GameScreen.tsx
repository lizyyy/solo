import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { ScheduleView } from '../components/game/ScheduleView';
import { OrderQueue } from '../components/game/OrderQueue';
import { CostPanel } from '../components/game/CostPanel';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, BarChart3 } from 'lucide-react';
import { HistoryRecorder } from '../game/recorder';
import { CostCalculator } from '../game/calculator';

interface GameScreenProps {
  onBack: () => void;
  onShowReport: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ onBack, onShowReport }) => {
  const {
    gameState,
    currentLevel,
    setScheduledOrders,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    setSpeed
  } = useGame();

  useEffect(() => {
    if (gameState.status === 'completed' || gameState.status === 'failed') {
      const result = {
        isWin: gameState.status === 'completed' && gameState.costs.total <= (currentLevel?.targetCost || 0),
        score: CostCalculator.calculateScore(
          gameState.costs.total,
          currentLevel?.targetCost || 1,
          gameState.status === 'completed' && gameState.costs.total <= (currentLevel?.targetCost || 0)
        ),
        stars: 0
      };
      result.stars = CostCalculator.calculateStars(result.score);
      
      if (currentLevel) {
        HistoryRecorder.saveLevelProgress(currentLevel.id, {
          ...result,
          finalCost: gameState.costs.total
        });
        
        const history = HistoryRecorder.createHistoryFromGameState(
          gameState,
          currentLevel,
          result
        );
        HistoryRecorder.saveHistory(history);
      }
    }
  }, [gameState.status]);

  if (!currentLevel) {
    return <div>关卡未找到</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white">
              第 {currentLevel.id} 关: {currentLevel.name}
            </h1>
            <p className="text-xs text-gray-400">{currentLevel.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(gameState.status === 'completed' || gameState.status === 'failed') && (
            <Button onClick={onShowReport} variant="primary">
              <BarChart3 className="w-4 h-4 mr-2" />
              查看报告
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-12 gap-6 h-[calc(100vh-56px)]">
        <div className="col-span-3">
          <OrderQueue
            level={currentLevel}
            scheduledOrders={gameState.scheduledOrders}
            onScheduleChange={setScheduledOrders}
            isRunning={gameState.status === 'running' || gameState.status === 'paused'}
            onStart={startGame}
            onPause={pauseGame}
            onResume={resumeGame}
            onReset={resetGame}
            speed={gameState.speed}
            onSpeedChange={setSpeed}
            status={gameState.status}
          />
        </div>

        <div className="col-span-6">
          <ScheduleView state={gameState} level={currentLevel} />
        </div>

        <div className="col-span-3">
          <CostPanel state={gameState} level={currentLevel} />
        </div>
      </div>
    </div>
  );
};
