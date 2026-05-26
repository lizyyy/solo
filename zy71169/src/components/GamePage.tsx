import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import GameScene from './GameScene';
import OrderQueue from './OrderQueue';
import HUD from './HUD';
import ResultReport from './ResultReport';
import { useNavigate, useParams } from 'react-router-dom';

export default function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const startGame = useGameStore(state => state.startGame);
  const tick = useGameStore(state => state.tick);
  const phase = useGameStore(state => state.phase);
  const currentSessionId = useGameStore(state => state.currentSessionId);
  const isPaused = useGameStore(state => state.isPaused);

  useEffect(() => {
    if (levelId) {
      startGame(levelId);
    }
  }, [levelId, startGame]);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }

      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (!isPaused && phase === 'playing') {
        tick(deltaTime);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [tick, phase, isPaused]);

  const handleDropOnStation = useCallback((stationId: string) => {
    const draggedMeal = useGameStore.getState().draggedMeal;
    if (draggedMeal) {
      useGameStore.getState().placeMeal(draggedMeal, stationId);
      useGameStore.getState().setDraggedMeal(null);
    }
  }, []);

  if (phase === 'ended' && currentSessionId) {
    return <ResultReport />;
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-900">
      <div className="absolute inset-0">
        <GameScene />
      </div>

      <OrderQueue />

      <HUD />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="flex gap-2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
          <span className="text-white text-sm">🎮 拖拽餐品到备餐台</span>
          <span className="text-gray-400">|</span>
          <span className="text-white text-sm">👆 点击取餐窗口分配学生</span>
          <span className="text-gray-400">|</span>
          <span className="text-white text-sm">空格键暂停</span>
        </div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const orderId = e.dataTransfer.getData('orderId');
          if (orderId) {
            const stationId = e.dataTransfer.getData('stationId');
            if (stationId) {
              handleDropOnStation(stationId);
            }
          }
        }}
      />
    </div>
  );
}