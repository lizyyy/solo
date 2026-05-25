import { useGameStore } from '@/store/gameStore';
import { FAULT_TYPE_NAMES, MOOD_NAMES } from '@/config/levels';
import { Users, Heart, Clock, AlertTriangle } from 'lucide-react';
import type { Elevator } from '@/types/game';

interface PassengerPanelProps {
  elevators: Elevator[];
}

export default function PassengerPanel({ elevators }: PassengerPanelProps) {
  const { selectElevator, selectedElevatorId, status } = useGameStore();

  const activeElevators = elevators.filter((e) => e.status === 'fault' || e.status === 'rescuing');

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'calm':
        return 'text-[#4caf50]';
      case 'anxious':
        return 'text-[#ffc107]';
      case 'panic':
        return 'text-[#ff4d4d]';
      default:
        return 'text-gray-400';
    }
  };

  const getMoodBg = (mood: string) => {
    switch (mood) {
      case 'calm':
        return 'bg-[#4caf50]/20';
      case 'anxious':
        return 'bg-[#ffc107]/20';
      case 'panic':
        return 'bg-[#ff4d4d]/20';
      default:
        return 'bg-gray-500/20';
    }
  };

  return (
    <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
      <h3 className="text-lg font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
        <Users size={20} />
        乘客状态
        {activeElevators.length > 0 && (
          <span className="text-xs font-normal text-[#ff4d4d] ml-2">
            {activeElevators.length} 处故障待处理
          </span>
        )}
      </h3>

      {activeElevators.length === 0 ? (
        <div className="text-center text-gray-500 text-sm py-8">
          <Heart size={32} className="mx-auto mb-2 text-[#4caf50] opacity-50" />
          <p>所有乘客安全</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeElevators.map((elevator) => {
            const isSelected = selectedElevatorId === elevator.id;
            const moodProgress = Math.min((elevator.waitTime / 90) * 100, 100);

            return (
              <div
                key={elevator.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#ff8a00] bg-[#ff8a00]/10'
                    : 'border-gray-700 bg-[#1a2a4a] hover:border-[#ff8a00]/50'
                }`}
                onClick={() => status !== 'paused' && status !== 'replaying' && selectElevator(elevator.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      size={16}
                      className={elevator.status === 'fault' ? 'text-[#ff4d4d] animate-pulse' : 'text-[#ffc107]'}
                    />
                    <span className="font-bold text-white">{elevator.name}</span>
                    <span className="text-xs text-gray-400">
                      {Math.floor(elevator.currentFloor + 1)}F
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${getMoodBg(elevator.mood)} ${getMoodColor(elevator.mood)}`}>
                    {MOOD_NAMES[elevator.mood]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-300 mb-2">
                  <div className="flex items-center gap-1">
                    <Users size={12} />
                    <span>{elevator.passengerCount} 人</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{Math.floor(elevator.waitTime)}s</span>
                  </div>
                  <div className="text-right text-gray-400">
                    {FAULT_TYPE_NAMES[elevator.faultType || '']}
                  </div>
                </div>

                <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      moodProgress > 66
                        ? 'bg-[#ff4d4d]'
                        : moodProgress > 33
                        ? 'bg-[#ffc107]'
                        : 'bg-[#4caf50]'
                    }`}
                    style={{ width: `${moodProgress}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-white/50"
                    style={{ left: '33%' }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-white/50"
                    style={{ left: '66%' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>30s 焦虑</span>
                  <span>60s 恐慌</span>
                  <span>90s 超时</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
