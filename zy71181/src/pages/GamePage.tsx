import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { Game3DScene } from '../components/game/Game3DScene';
import { Game2DMap } from '../components/game/Game2DMap';
import { StatusBar } from '../components/game/StatusBar';
import { VictimPanel } from '../components/game/VictimPanel';
import { PatrollerPanel } from '../components/game/PatrollerPanel';
import { EquipmentSelector } from '../components/game/EquipmentSelector';
import { PauseMenu } from '../components/game/PauseMenu';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const { gameState, startGame } = useGameStore();
  const { startLoop, stopLoop } = useGameLoop();
  const [showPauseMenu, setShowPauseMenu] = useState(false);

  useEffect(() => {
    if (levelId) {
      startGame(levelId);
    }
  }, [levelId, startGame]);

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, [startLoop, stopLoop]);

  useEffect(() => {
    if (gameState.status === 'victory' || gameState.status === 'defeat') {
      navigate('/result');
    }
  }, [gameState.status, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameState.status === 'playing') {
          useGameStore.getState().pauseGame();
          setShowPauseMenu(true);
        } else if (gameState.status === 'paused') {
          useGameStore.getState().resumeGame();
          setShowPauseMenu(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status]);

  const handleClosePauseMenu = () => {
    setShowPauseMenu(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
      <StatusBar />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 p-4 space-y-4 overflow-y-auto flex-shrink-0">
          <VictimPanel />
          <PatrollerPanel />
        </div>

        <div className="flex-1 relative">
          <Game3DScene />

          <div className="absolute bottom-4 left-4 w-80">
            <Game2DMap />
          </div>
        </div>

        <div className="w-72 p-4 overflow-y-auto flex-shrink-0">
          <EquipmentSelector />
        </div>
      </div>

      {showPauseMenu && <PauseMenu onClose={handleClosePauseMenu} />}
    </div>
  );
}
