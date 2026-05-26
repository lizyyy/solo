import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { GameScene } from '../components/game/GameScene';
import { RobotCard } from '../components/ui/RobotCard';
import { OrderList } from '../components/ui/OrderList';
import { GameControls } from '../components/ui/GameControls';
import { ScoreBoard } from '../components/ui/ScoreBoard';
import { GameOverModal } from '../components/ui/GameOverModal';
import { formatTime } from '../game/engine';
import { getLevelById } from '../game/levels';
import { Clock, Info } from 'lucide-react';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  
  const level = useGameStore((state) => state.level);
  const robots = useGameStore((state) => state.robots);
  const orders = useGameStore((state) => state.orders);
  const selectedRobotId = useGameStore((state) => state.selectedRobotId);
  const selectedRobot = useGameStore((state) => 
    state.robots.find((r) => r.id === state.selectedRobotId) || null
  );
  const isPaused = useGameStore((state) => state.isPaused);
  const isGameOver = useGameStore((state) => state.isGameOver);
  const gameSpeed = useGameStore((state) => state.gameSpeed);
  const gameTime = useGameStore((state) => state.gameTime);
  const score = useGameStore((state) => state.score);
  const events = useGameStore((state) => state.events);
  const currentRecordId = useGameStore((state) => state.currentRecordId);
  
  const startGame = useGameStore((state) => state.startGame);
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const restartGame = useGameStore((state) => state.restartGame);
  const setGameSpeed = useGameStore((state) => state.setGameSpeed);
  const selectRobot = useGameStore((state) => state.selectRobot);

  useGameLoop();

  useEffect(() => {
    if (levelId && getLevelById(levelId)) {
      startGame(levelId);
    } else {
      navigate('/');
    }
  }, [levelId, navigate, startGame]);

  if (!level) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const timeRemaining = Math.max(0, level.timeLimit - gameTime);
  const isTimeUrgent = timeRemaining < 60;

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className="flex-1 relative">
        <GameScene />
        
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <GameControls
              isPaused={isPaused}
              gameSpeed={gameSpeed}
              onPause={pauseGame}
              onResume={resumeGame}
              onRestart={restartGame}
              onSpeedChange={setGameSpeed}
            />
            
            <div className="px-4 py-2 bg-gray-800/80 rounded-lg backdrop-blur">
              <span className="text-gray-400 text-sm">{level.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg backdrop-blur ${
              isTimeUrgent ? 'bg-red-900/80 animate-pulse' : 'bg-gray-800/80'
            }`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isTimeUrgent ? 'text-red-400' : 'text-gray-400'}`} />
                <span className={`font-mono text-lg ${isTimeUrgent ? 'text-red-400' : 'text-white'}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {selectedRobotId && (
          <div className="absolute bottom-4 left-4 px-4 py-2 bg-blue-900/80 rounded-lg backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-blue-200">
              <Info className="w-4 h-4" />
              <span>点击地图任意位置为选中的机器人指派目标</span>
            </div>
          </div>
        )}
      </div>

      <div className="w-80 bg-gray-850 border-l border-gray-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <ScoreBoard score={score} isLive />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">机器人状态</h3>
            <div className="space-y-2">
              {robots.map((robot) => (
                <RobotCard
                  key={robot.id}
                  robot={robot}
                  isSelected={robot.id === selectedRobotId}
                  onSelect={() => robot.status !== 'dead' && selectRobot(robot.id)}
                />
              ))}
            </div>
          </div>

          <OrderList orders={orders} currentTime={gameTime} selectedRobot={selectedRobot} />
        </div>
      </div>

      {isGameOver && (
        <GameOverModal
          score={score}
          events={events}
          gameTime={gameTime}
          levelId={level.id}
          recordId={currentRecordId}
          onRestart={restartGame}
        />
      )}
    </div>
  );
}
