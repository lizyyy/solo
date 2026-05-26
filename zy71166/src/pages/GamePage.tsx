import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RoomScene } from '../components/game3d/RoomScene';
import { HUD } from '../components/ui/HUD';
import { ControlPanel } from '../components/ui/ControlPanel';
import { RackDetail } from '../components/ui/RackDetail';
import { useGameStore } from '../store/useGameStore';
import { useUISTore } from '../store/useUISTore';

export default function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const {
    racks,
    acUnits,
    gamePhase,
    initGame,
    resetGame,
  } = useGameStore();

  const {
    showHeatmap,
    showLabels,
    selectedRackId,
    resetUI,
  } = useUISTore();

  useEffect(() => {
    if (levelId) {
      initGame(levelId);
      resetUI();
    }

    return () => {
      resetUI();
    };
  }, [levelId, initGame, resetUI]);

  useEffect(() => {
    if (gamePhase === 'won' || gamePhase === 'lost') {
      navigate('/result');
    }
  }, [gamePhase, navigate]);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <RoomScene
          racks={racks}
          acUnits={acUnits}
          showHeatmap={showHeatmap}
          showLabels={showLabels}
          interactive={gamePhase === 'playing' || gamePhase === 'paused'}
        />
      </div>

      <HUD />
      <ControlPanel />
      {selectedRackId && <RackDetail />}
    </div>
  );
}
