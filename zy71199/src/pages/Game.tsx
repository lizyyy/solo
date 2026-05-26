import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { getLevel } from '@/data/levels';
import GameScene from '@/components/three/GameScene';
import HUD from '@/components/HUD';
import ControlPanel from '@/components/ControlPanel';
import BorrowPanel from '@/components/BorrowPanel';
import { useState } from 'react';

export default function Game() {
  const navigate = useNavigate();
  const {
    phase,
    currentLevelId,
    currentFile,
    currentFileIndex,
    selectedBoxId,
    selectedConfidentiality,
    selectBox,
    submitFile,
    currentBorrowRequest,
    tick,
  } = useGameStore();

  const [showBorrowPanel, setShowBorrowPanel] = useState(false);

  const level = currentLevelId ? getLevel(currentLevelId) : null;

  useEffect(() => {
    if (phase === 'playing') {
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, tick]);

  useEffect(() => {
    if (currentBorrowRequest && !showBorrowPanel) {
      setShowBorrowPanel(true);
    }
  }, [currentBorrowRequest]);

  useEffect(() => {
    if (phase === 'finished') {
      navigate('/report');
    }
  }, [phase, navigate]);

  if (phase === 'menu' || phase === 'finished' || !level) {
    return null;
  }

  const handleDragFileToBox = (boxId: string) => {
    selectBox(boxId);
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#1a3a2e]">
      <div className="flex-1 relative">
        <GameScene
          boxes={level.boxes}
          currentFile={currentFile}
          selectedBoxId={selectedBoxId}
          selectedConfidentiality={selectedConfidentiality}
          onSelectBox={selectBox}
          onDragFileToBox={handleDragFileToBox}
          disabled={phase !== 'playing'}
        />
        <HUD />
      </div>
      <ControlPanel boxes={level.boxes} />
      {showBorrowPanel && currentBorrowRequest && (
        <BorrowPanel onClose={() => setShowBorrowPanel(false)} />
      )}
    </div>
  );
}