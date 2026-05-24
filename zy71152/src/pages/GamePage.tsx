import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import GameCanvas from '../components/GameCanvas';
import GameControls from '../components/GameControls';
import GameOver from '../components/GameOver';
import Timeline from '../components/Timeline';

interface GamePageProps {
  levelId: number;
  onBackToMenu: () => void;
}

export default function GamePage({ levelId, onBackToMenu }: GamePageProps) {
  const { loadLevel, update, status, saveReplay } = useGameStore();
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const [showReplayOption, setShowReplayOption] = useState(false);

  useEffect(() => {
    loadLevel(levelId);
  }, [levelId, loadLevel]);

  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastTimeRef.current) / 16.67;
      lastTimeRef.current = timestamp;

      update(deltaTime);
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [update]);

  const handleReplay = () => {
    saveReplay();
    setShowReplayOption(true);
    setTimeout(() => {
      onBackToMenu();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <GameCanvas width={900} height={450} />
            <div className="mt-4">
              <Timeline />
            </div>
          </div>
          <div className="lg:col-span-1">
            <GameControls onBackToMenu={onBackToMenu} />
          </div>
        </div>
      </div>
      <GameOver onBackToMenu={onBackToMenu} onReplay={handleReplay} />
      {showReplayOption && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-800 rounded-xl p-6 text-center">
            <div className="text-emerald-400 text-lg mb-2">✓ 回放已保存</div>
            <div className="text-slate-400 text-sm">返回菜单查看历史回放</div>
          </div>
        </div>
      )}
    </div>
  );
}
