import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import GameCanvasView from '@/components/GameCanvasView';
import TopBar from '@/components/TopBar';
import SidePanel from '@/components/SidePanel';
import EventLog from '@/components/EventLog';
import SettlementModal from '@/components/SettlementModal';
import { Play } from 'lucide-react';

export default function Game() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const state = useGameStore();
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);

  useEffect(() => {
    if (levelId && state.phase === 'menu') {
      state.startGame(Number(levelId));
    }
  }, [levelId, state.phase]);

  useEffect(() => {
    if (state.phase === 'menu' && levelId) {
      state.startGame(Number(levelId));
    }
  }, [levelId]);

  const handleBoothClick = (boothId: string) => {
    setSelectedBoothId(boothId);
  };

  const handleBoothHover = (_boothId: string | null) => {
  };

  const handleSelectCrew = (crewId: string) => {
    setSelectedCrewId(crewId);
  };

  const handleAssignTask = (taskType: 'utilities' | 'structure' | 'fire_safety') => {
    if (!selectedBoothId || !selectedCrewId) return;
    state.assignCrewTask(selectedCrewId, selectedBoothId, taskType);
  };

  const handleRequestInspection = (type: 'utilities' | 'structure' | 'fire') => {
    state.applyInspection(type);
  };

  const handleEmergencyDelivery = (materialType: string) => {
    if (!selectedBoothId) return;
    state.requestEmergency(materialType, selectedBoothId);
  };

  const handleGoToMenu = () => {
    state.goToMenu();
    navigate('/');
  };

  const isPaused = state.phase === 'paused';
  const isEnded = state.phase === 'ended';

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <TopBar onGoToMenu={handleGoToMenu} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <GameCanvasView
            onBoothClick={handleBoothClick}
            onBoothHover={handleBoothHover}
            selectedBoothId={selectedBoothId}
          />

          {isPaused && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">⏸</div>
                <h2 className="text-2xl font-bold text-white mb-4">游戏已暂停</h2>
                <button
                  onClick={state.resumeGame}
                  className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 mx-auto transition-all"
                >
                  <Play size={20} />
                  继续游戏
                </button>
              </div>
            </div>
          )}
        </div>

        <SidePanel
          selectedBoothId={selectedBoothId}
          selectedCrewId={selectedCrewId}
          onSelectCrew={handleSelectCrew}
          onAssignTask={handleAssignTask}
          onRequestInspection={handleRequestInspection}
          onEmergencyDelivery={handleEmergencyDelivery}
        />
      </div>

      <EventLog />

      {isEnded && <SettlementModal onGoToMenu={handleGoToMenu} />}
    </div>
  );
}
