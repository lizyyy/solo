import { useGameStore } from '@/store/gameStore';
import { TEAM_STATUS_NAMES } from '@/config/levels';
import { Wrench, MapPin, Clock, X, CheckCircle, AlertTriangle } from 'lucide-react';
import type { MaintenanceTeam, Elevator } from '@/types/game';

interface TeamPanelProps {
  teams: MaintenanceTeam[];
  elevators: Elevator[];
}

export default function TeamPanel({ teams, elevators }: TeamPanelProps) {
  const { selectedTeamId, selectTeam, cancelTeamAssignment, status } = useGameStore();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-[#4caf50]';
      case 'moving':
        return 'bg-[#ff8a00]';
      case 'working':
        return 'bg-[#2196f3]';
      case 'conflict':
        return 'bg-[#ff4d4d]';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBg = (teamStatus: string, isSelected: boolean) => {
    if (isSelected) return 'bg-[#ff8a00]/30 border-[#ff8a00]';
    switch (teamStatus) {
      case 'idle':
        return 'bg-[#4caf50]/10 border-[#4caf50]/50 hover:bg-[#4caf50]/20';
      case 'moving':
        return 'bg-[#ff8a00]/10 border-[#ff8a00]/50';
      case 'working':
        return 'bg-[#2196f3]/10 border-[#2196f3]/50';
      case 'conflict':
        return 'bg-[#ff4d4d]/10 border-[#ff4d4d]/50';
      default:
        return 'bg-gray-500/10 border-gray-500/50';
    }
  };

  return (
    <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
      <h3 className="text-lg font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
        <Wrench size={20} />
        维保队
        {selectedTeamId && (
          <span className="text-xs font-normal text-[#4caf50] ml-2 flex items-center gap-1">
            <CheckCircle size={12} />
            已选中，点击故障电梯派遣
          </span>
        )}
      </h3>

      <div className="space-y-3">
        {teams.map((team) => {
          const isSelected = selectedTeamId === team.id;
          const assignedElevator = elevators.find((e) => e.id === team.assignedElevatorId);
          const canSelect = team.status === 'idle' && status !== 'paused' && status !== 'replaying';

          return (
            <div
              key={team.id}
              className={`p-3 rounded-lg border transition-all ${getStatusBg(team.status, isSelected)} ${
                canSelect ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={() => canSelect && selectTeam(isSelected ? null : team.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(team.status)} ${team.status === 'moving' ? 'animate-pulse' : ''}`} />
                  <span className="font-bold text-white">{team.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(team.status)} text-white`}>
                  {TEAM_STATUS_NAMES[team.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div className="flex items-center gap-1">
                  <MapPin size={12} className="text-gray-400" />
                  <span>{Math.floor(team.currentFloor + 1)}F</span>
                </div>
                {team.status !== 'idle' && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-gray-400" />
                    <span>目标 {Math.floor(team.targetFloor + 1)}F</span>
                  </div>
                )}
              </div>

              {assignedElevator && (
                <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
                  <span>
                    处理: {assignedElevator.name} ({Math.floor(assignedElevator.currentFloor + 1)}F)
                  </span>
                  {team.status === 'conflict' && (
                    <span className="flex items-center gap-1 text-[#ff4d4d]">
                      <AlertTriangle size={12} />
                      冲突
                    </span>
                  )}
                </div>
              )}

              {team.status === 'working' && assignedElevator && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4caf50] transition-all"
                      style={{
                        width: `${(assignedElevator.rescueProgress / (assignedElevator.faultType ? 15 : 10)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {team.status !== 'idle' && status !== 'paused' && status !== 'replaying' && (
                <button
                  className="mt-2 w-full py-1 text-xs bg-[#ff4d4d]/20 hover:bg-[#ff4d4d]/40 text-[#ff4d4d] rounded transition-colors flex items-center justify-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelTeamAssignment(team.id);
                  }}
                >
                  <X size={12} />
                  取消派遣
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-[#1a2a4a] rounded-lg text-xs text-gray-400">
        <p className="font-bold text-[#ff8a00] mb-1">操作提示</p>
        <p>1. 点击待命状态的维保队</p>
        <p>2. 点击左侧闪烁的故障电梯</p>
        <p>3. 维保队会自动前往并救援</p>
      </div>
    </div>
  );
}
