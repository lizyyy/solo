import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { LEVELS } from '@/game/levels';
import StatusBar from '@/components/StatusBar';
import { GameCanvas } from '@/components/GameCanvas';
import { InfoPanel } from '@/components/InfoPanel';
import ControlPanel from '@/components/ControlPanel';
import ResultModal from '@/components/ResultModal';

export default function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const { setLevel, showResult } = useGameStore();

  useEffect(() => {
    if (levelId) {
      const level = LEVELS.find((l) => l.id.toString() === levelId);
      if (level) {
        setLevel(level);
      }
    }
  }, [levelId, setLevel]);

  return (
    <div className="w-screen h-screen bg-museum-bg flex flex-col overflow-hidden">
      <div className="p-4 pb-2">
        <StatusBar />
      </div>
      <div className="flex-1 flex gap-4 px-4 min-h-0">
        <GameCanvas />
        <InfoPanel />
      </div>
      <div className="p-4 pt-2">
        <ControlPanel />
      </div>
      {showResult && <ResultModal />}
    </div>
  );
}
