import { useGameStore } from '../game/state';
import { useGameLoop } from '../hooks/useGameLoop';
import { Timeline } from './Timeline';
import { RoomGrid } from './RoomGrid';
import { GuestQueue } from './GuestQueue';
import { ScorePanel } from './ScorePanel';
import { ControlPanel } from './ControlPanel';
import { EventLog } from './EventLog';
import { Settlement } from './Settlement';

export function GameBoard() {
  const status = useGameStore((state) => state.status);

  useGameLoop(800);

  const showSettlement = status === 'settlement' || status === 'replay';

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🏨</span> 酒店客房调度游戏
          </h1>
          <div className="text-sm text-gray-400">
            {status === 'playing' && <span className="text-green-400">● 运行中</span>}
            {status === 'paused' && <span className="text-yellow-400">● 已暂停</span>}
          </div>
        </div>

        <div className="mb-4">
          <Timeline height={140} />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5 space-y-4">
            <RoomGrid />
          </div>

          <div className="col-span-4 space-y-4">
            <GuestQueue />
            <EventLog />
          </div>

          <div className="col-span-3 space-y-4">
            <ScorePanel />
            <ControlPanel />
          </div>
        </div>
      </div>

      {showSettlement && <Settlement />}
    </div>
  );
}
