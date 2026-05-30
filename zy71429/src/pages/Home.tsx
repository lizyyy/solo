import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameHeader from '@/components/GameHeader';
import ShipQueue from '@/components/ShipQueue';
import PortOverview from '@/components/PortOverview';
import TimelineGantt from '@/components/TimelineGantt';
import SchedulingPanel from '@/components/SchedulingPanel';
import EventMonitor from '@/components/EventMonitor';
import DecisionAnalysis from '@/components/DecisionAnalysis';
import BadDataDialog from '@/components/BadDataDialog';
import ReplayPlayer from '@/components/ReplayPlayer';

export default function Home() {
  const { initializeGame, isGameOver, resetGame } = useGameStore();
  const [showReplay, setShowReplay] = useState(false);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader 
        onShowReplay={() => setShowReplay(true)}
      />
      
      <main className="flex-1 flex flex-col p-4 gap-4">
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-80 flex flex-col gap-4 flex-shrink-0">
            <ShipQueue />
          </div>
          
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <PortOverview />
            <TimelineGantt className="flex-1" />
            <SchedulingPanel />
          </div>
          
          <div className="w-96 flex flex-col gap-4 flex-shrink-0">
            <EventMonitor />
            <DecisionAnalysis />
          </div>
        </div>
      </main>

      <BadDataDialog />
      
      <ReplayPlayer 
        isOpen={showReplay} 
        onClose={() => setShowReplay(false)} 
      />
      
      {isGameOver && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="card p-8 max-w-lg w-full mx-4 text-center">
            <h2 className="font-display text-3xl text-ocean-100 mb-4">游戏结束</h2>
            <p className="text-ocean-200 mb-6">感谢参与港口风浪靠泊赛！</p>
            <div className="flex gap-4 justify-center">
              <button 
                className="btn-primary"
                onClick={resetGame}
              >
                重新开始
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setShowReplay(true)}
              >
                查看复盘
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
