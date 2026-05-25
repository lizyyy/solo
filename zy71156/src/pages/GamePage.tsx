import { useGameStore } from '@/store/gameStore';
import { useGameLoop } from '@/hooks/useGameLoop';
import BuildingView from '@/components/BuildingView';
import TeamPanel from '@/components/TeamPanel';
import EventLog from '@/components/EventLog';
import PassengerPanel from '@/components/PassengerPanel';
import TopBar from '@/components/TopBar';
import ResultsPage from '@/pages/ResultsPage';
import { Navigate } from 'react-router-dom';

export default function GamePage() {
  const { status, currentLevel, elevators, teams, events, score, gameTime } = useGameStore();
  useGameLoop();

  if (status === 'menu') {
    return <Navigate to="/" replace />;
  }

  if (status === 'ended' || status === 'replaying') {
    return <ResultsPage />;
  }

  if (!currentLevel) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1e3d] via-[#1a2a4a] to-[#0f1e3d] text-white p-4">
      <div className="max-w-full mx-auto space-y-4">
        <TopBar score={score} gameTime={gameTime} level={currentLevel} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BuildingView
              floorCount={currentLevel.floorCount}
              elevators={elevators}
              teams={teams}
            />
          </div>

          <div className="space-y-4">
            <TeamPanel teams={teams} elevators={elevators} />
            <PassengerPanel elevators={elevators} />
          </div>
        </div>

        <EventLog events={events} />
      </div>
    </div>
  );
}
