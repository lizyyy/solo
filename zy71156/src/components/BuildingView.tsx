import { useGameStore } from '@/store/gameStore';
import { FAULT_TYPE_NAMES, MOOD_NAMES } from '@/config/levels';
import { AlertTriangle, Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Elevator, MaintenanceTeam } from '@/types/game';

interface BuildingViewProps {
  floorCount: number;
  elevators: Elevator[];
  teams: MaintenanceTeam[];
}

export default function BuildingView({ floorCount, elevators, teams }: BuildingViewProps) {
  const { selectedTeamId, selectedElevatorId, selectElevator, status } = useGameStore();

  const getElevatorStatusColor = (elevator: Elevator) => {
    switch (elevator.status) {
      case 'normal':
        return 'bg-[#4caf50]';
      case 'fault':
        return 'bg-[#ff4d4d]';
      case 'rescuing':
        return 'bg-[#ffc107]';
      case 'rescued':
        return 'bg-[#2196f3]';
      case 'holding':
        return 'bg-[#2196f3]';
      default:
        return 'bg-gray-500';
    }
  };

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

  const getElevatorY = (floor: number, floorHeight: number) => {
    return (floorCount - 1 - floor) * floorHeight + floorHeight / 2;
  };

  const floorHeight = 60;
  const elevatorWidth = 80;
  const elevatorGap = 30;
  const buildingWidth = elevators.length * (elevatorWidth + elevatorGap) + elevatorGap;
  const buildingHeight = floorCount * floorHeight;

  return (
    <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
      <h3 className="text-lg font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
        <AlertTriangle size={20} />
        建筑楼层视图
      </h3>

      <div className="relative overflow-auto" style={{ maxHeight: '600px' }}>
        <div
          className="relative bg-gradient-to-b from-[#1a2a4a] to-[#0f1e3d] rounded-lg border-2 border-[#ff8a00]/30"
          style={{
            width: buildingWidth + 80,
            height: buildingHeight + 20,
            minWidth: '100%',
          }}
        >
          {Array.from({ length: floorCount }).map((_, i) => {
            const floorNum = floorCount - 1 - i;
            return (
              <div
                key={i}
                className="absolute left-0 right-0 border-b border-[#ff8a00]/10"
                style={{ top: i * floorHeight, height: floorHeight }}
              >
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono w-12">
                  {floorNum === 0 ? '1F (大堂)' : `${floorNum + 1}F`}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-[1px] h-full bg-[#ff8a00]/5" />
              </div>
            );
          })}

          {elevators.map((elevator, idx) => {
            const elevatorX = 60 + idx * (elevatorWidth + elevatorGap);
            const elevatorY = getElevatorY(elevator.currentFloor, floorHeight);
            const isSelected = selectedElevatorId === elevator.id;
            const isTargetable = selectedTeamId !== null && (elevator.status === 'fault' || elevator.status === 'holding');
            const assignedTeam = teams.find((t) => t.assignedElevatorId === elevator.id && t.status !== 'idle');

            return (
              <div key={elevator.id}>
                <div
                  className="absolute rounded-lg border-2 transition-all cursor-pointer"
                  style={{
                    left: elevatorX,
                    top: elevatorY - 25,
                    width: elevatorWidth,
                    height: 50,
                    borderColor: isSelected
                      ? '#ff8a00'
                      : isTargetable
                      ? '#ff4d4d'
                      : '#334155',
                    boxShadow: elevator.status === 'fault'
                      ? '0 0 20px rgba(255, 77, 77, 0.5)'
                      : elevator.status === 'holding'
                      ? '0 0 15px rgba(33, 150, 243, 0.5)'
                      : isTargetable
                      ? '0 0 15px rgba(255, 77, 77, 0.3)'
                      : isSelected
                      ? '0 0 15px rgba(255, 138, 0, 0.5)'
                      : 'none',
                    backgroundColor: elevator.status === 'fault'
                      ? 'rgba(255, 77, 77, 0.1)'
                      : elevator.status === 'rescuing'
                      ? 'rgba(255, 193, 7, 0.1)'
                      : elevator.status === 'holding'
                      ? 'rgba(33, 150, 243, 0.1)'
                      : 'rgba(26, 42, 74, 0.8)',
                  }}
                  onClick={() => status !== 'paused' && status !== 'replaying' && selectElevator(elevator.id)}
                >
                  <div className="h-full flex flex-col justify-center items-center p-1">
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-xs font-bold text-white">{elevator.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getElevatorStatusColor(elevator)} text-white`}>
                        {elevator.status === 'fault' ? '故障' : elevator.status === 'rescuing' ? '救援中' : elevator.status === 'rescued' ? '已救' : elevator.status === 'holding' ? '管制' : '正常'}
                      </span>
                    </div>

                    {elevator.status === 'fault' || elevator.status === 'rescuing' ? (
                      <div className="w-full mt-1 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-gray-300">
                          <span className="flex items-center gap-1">
                            <Users size={10} />
                            {elevator.passengerCount}人
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {Math.floor(elevator.waitTime)}s
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {FAULT_TYPE_NAMES[elevator.faultType || '']}
                        </div>
                        <div className={`text-[10px] ${getMoodColor(elevator.mood)}`}>
                          {MOOD_NAMES[elevator.mood]}
                        </div>
                        {elevator.status === 'rescuing' && elevator.rescueProgress > 0 && (
                          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-[#ffc107] transition-all"
                              style={{
                                width: `${(elevator.rescueProgress / (elevator.faultType ? 15 : 10)) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 mt-1">
                        {Math.floor(elevator.currentFloor + 1)}F · {elevator.passengerCount}人
                      </div>
                    )}

                    {assignedTeam && (
                      <div className="absolute -top-1 -right-1 bg-[#ff8a00] text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Loader2 size={10} className="animate-spin" />
                        {assignedTeam.name.replace('维保 ', '').replace(' 队', '')}
                      </div>
                    )}
                  </div>

                  {elevator.status === 'fault' && (
                    <div className="absolute -top-2 -right-2 animate-pulse">
                      <AlertTriangle size={16} className="text-[#ff4d4d] fill-[#ff4d4d]" />
                    </div>
                  )}
                  {elevator.status === 'rescued' && (
                    <div className="absolute -top-2 -right-2">
                      <CheckCircle size={16} className="text-[#4caf50]" />
                    </div>
                  )}
                </div>

                <div
                  className="absolute w-0.5 bg-[#ff8a00]/20"
                  style={{
                    left: elevatorX + elevatorWidth / 2,
                    top: 0,
                    height: buildingHeight,
                  }}
                />
              </div>
            );
          })}

          {teams.map((team) => {
            if (team.status === 'idle') return null;
            const assignedElevator = elevators.find((e) => e.id === team.assignedElevatorId);
            if (!assignedElevator) return null;

            const elevatorIdx = elevators.findIndex((e) => e.id === team.assignedElevatorId);
            const elevatorX = 60 + elevatorIdx * (elevatorWidth + elevatorGap);
            const teamY = getElevatorY(team.currentFloor, floorHeight);

            return (
              <div
                key={team.id}
                className="absolute transition-all duration-100 z-10"
                style={{
                  left: elevatorX + elevatorWidth + 5,
                  top: teamY - 8,
                }}
              >
                <div
                  className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                    team.status === 'conflict'
                      ? 'bg-[#ff4d4d] text-white'
                      : team.status === 'working'
                      ? 'bg-[#4caf50] text-white'
                      : 'bg-[#ff8a00] text-white'
                  }`}
                >
                  {team.status === 'moving' && <Loader2 size={12} className="animate-spin" />}
                  {team.status === 'conflict' && <XCircle size={12} />}
                  {team.name.replace('维保 ', '').replace(' 队', '')}
                  {team.status === 'working' && (
                    <span className="ml-1">
                      {Math.floor((assignedElevator.rescueProgress / (assignedElevator.faultType ? 15 : 10)) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#4caf50]" />
          <span>正常</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#ff4d4d]" />
          <span>故障</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#ffc107]" />
          <span>救援中</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#2196f3]" />
          <span>已救援/管制</span>
        </div>
      </div>
    </div>
  );
}
