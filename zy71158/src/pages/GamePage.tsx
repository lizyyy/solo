import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { useGameLoop } from '@/hooks/useGameLoop';
import TopBar from '@/components/game/TopBar';
import GameCanvas from '@/components/game/GameCanvas';
import ControlPanel from '@/components/game/ControlPanel';
import Dashboard from '@/components/game/Dashboard';
import EventLog from '@/components/game/EventLog';
import SettlementModal from '@/components/modals/SettlementModal';
import ReplayModal from '@/components/modals/ReplayModal';
import LevelSelectModal from '@/components/modals/LevelSelectModal';

export default function GamePage() {
  const { phase } = useGameStore();

  useGameLoop();

  if (phase === 'menu') {
    return <LevelSelectModal />;
  }

  return (
    <div className="min-h-screen bg-night-bg flex flex-col">
      <TopBar />

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        <div className="w-72 flex-shrink-0">
          <ControlPanel />
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex-1 flex items-center justify-center">
            <GameCanvas />
          </div>
          <EventLog />
        </div>

        <div className="w-72 flex-shrink-0">
          <Dashboard />
        </div>
      </div>

      {phase === 'settlement' && <SettlementModal />}
      {phase === 'replay' && <ReplayModal />}
    </div>
  );
}