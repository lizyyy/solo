import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { FAULT_TYPE_NAMES, MOOD_NAMES, DIAGNOSIS_MAX_ATTEMPTS } from '@/config/levels';
import { Users, Heart, Clock, AlertTriangle, MessageCircle, Stethoscope, Lock, Unlock, CheckCircle, XCircle } from 'lucide-react';
import type { Elevator, FaultType } from '@/types/game';

interface PassengerPanelProps {
  elevators: Elevator[];
}

export default function PassengerPanel({ elevators }: PassengerPanelProps) {
  const {
    selectElevator,
    selectedElevatorId,
    status,
    comfortPassengers,
    diagnoseFault,
    holdElevatorAtFloor,
    releaseElevatorHold,
    teams,
  } = useGameStore();

  const [showDiagnosis, setShowDiagnosis] = useState<string | null>(null);

  const activeElevators = elevators.filter(
    (e) => e.status === 'fault' || e.status === 'rescuing' || e.status === 'holding'
  );

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

  const idleTeams = teams.filter((t) => t.status === 'idle');

  const handleComfort = (elevatorId: string) => {
    if (idleTeams.length === 0) return;
    const team = idleTeams[0];
    comfortPassengers(team.id, elevatorId);
  };

  const handleDiagnose = (elevatorId: string, suspectedType: FaultType) => {
    diagnoseFault(elevatorId, suspectedType);
    setShowDiagnosis(null);
  };

  const handleHold = (elevator: Elevator) => {
    if (elevator.holdFloor !== null) {
      releaseElevatorHold(elevator.id);
    } else {
      holdElevatorAtFloor(elevator.id, Math.floor(elevator.currentFloor));
    }
  };

  return (
    <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
      <h3 className="text-lg font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
        <Users size={20} />
        乘客状态 & 操作
        {activeElevators.length > 0 && (
          <span className="text-xs font-normal text-[#ff4d4d] ml-2">
            {activeElevators.length} 处需要处理
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
            const canComfort = elevator.mood !== 'calm' && idleTeams.length > 0 && status !== 'paused' && status !== 'replaying';
            const canDiagnose = elevator.status === 'fault' && elevator.diagnosisAttempts < DIAGNOSIS_MAX_ATTEMPTS && status !== 'paused' && status !== 'replaying';
            const isHolding = elevator.holdFloor !== null;

            return (
              <div
                key={elevator.id}
                className={`p-3 rounded-lg border transition-all ${
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
                      className={
                        elevator.status === 'fault'
                          ? 'text-[#ff4d4d] animate-pulse'
                          : elevator.status === 'holding'
                          ? 'text-[#2196f3]'
                          : 'text-[#ffc107]'
                      }
                    />
                    <span className="font-bold text-white">{elevator.name}</span>
                    <span className="text-xs text-gray-400">
                      {Math.floor(elevator.currentFloor + 1)}F
                    </span>
                    {isHolding && (
                      <span className="text-xs px-2 py-0.5 bg-[#2196f3]/20 text-[#2196f3] rounded">
                        已停靠管制
                      </span>
                    )}
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
                    {elevator.status === 'holding' ? '停靠管制' : FAULT_TYPE_NAMES[elevator.faultType || '']}
                  </div>
                </div>

                {elevator.status !== 'holding' && (
                  <>
                    <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
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
                    <div className="flex justify-between text-[10px] text-gray-500 mb-3">
                      <span>30s 焦虑</span>
                      <span>60s 恐慌</span>
                      <span>90s 超时</span>
                    </div>
                  </>
                )}

                {elevator.status === 'fault' && (
                  <div className="text-xs text-gray-400 mb-2">
                    诊断次数: {elevator.diagnosisAttempts}/{DIAGNOSIS_MAX_ATTEMPTS}
                    {elevator.diagnosisResult && (
                      <span className={`ml-2 ${elevator.diagnosisResult === 'correct' ? 'text-[#4caf50]' : 'text-[#ff4d4d]'}`}>
                        {elevator.diagnosisResult === 'correct' ? (
                          <span className="flex items-center gap-1"><CheckCircle size={12} /> 诊断正确</span>
                        ) : (
                          <span className="flex items-center gap-1"><XCircle size={12} /> 诊断错误</span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {elevator.status !== 'holding' && (
                    <>
                      <button
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded text-xs font-bold transition-colors ${
                          canComfort
                            ? 'bg-[#4caf50]/20 text-[#4caf50] hover:bg-[#4caf50]/30'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canComfort) handleComfort(elevator.id);
                        }}
                        disabled={!canComfort}
                      >
                        <MessageCircle size={12} />
                        安抚乘客
                      </button>

                      <button
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded text-xs font-bold transition-colors ${
                          canDiagnose
                            ? 'bg-[#9c27b0]/20 text-[#9c27b0] hover:bg-[#9c27b0]/30'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canDiagnose) setShowDiagnosis(showDiagnosis === elevator.id ? null : elevator.id);
                        }}
                        disabled={!canDiagnose}
                      >
                        <Stethoscope size={12} />
                        故障诊断
                      </button>
                    </>
                  )}

                  <button
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded text-xs font-bold transition-colors ${
                      status !== 'paused' && status !== 'replaying'
                        ? isHolding
                          ? 'bg-[#ff9800]/20 text-[#ff9800] hover:bg-[#ff9800]/30'
                          : 'bg-[#2196f3]/20 text-[#2196f3] hover:bg-[#2196f3]/30'
                        : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (status !== 'paused' && status !== 'replaying') handleHold(elevator);
                    }}
                    disabled={status === 'paused' || status === 'replaying'}
                  >
                    {isHolding ? (
                      <>
                        <Unlock size={12} />
                        解除管制
                      </>
                    ) : (
                      <>
                        <Lock size={12} />
                        停靠当前层
                      </>
                    )}
                  </button>
                </div>

                {showDiagnosis === elevator.id && canDiagnose && (
                  <div className="mt-3 p-3 bg-[#0a1628] rounded-lg border border-[#9c27b0]/30" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-gray-400 mb-2">请判断故障类型：</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['door_jam', 'power_out', 'overload', 'false_alarm', 'cable_issue'] as FaultType[]).map((type) => (
                        <button
                          key={type}
                          className="py-1.5 px-2 text-xs bg-[#1a2a4a] hover:bg-[#9c27b0]/30 hover:text-[#9c27b0] text-gray-300 rounded transition-colors text-left"
                          onClick={() => handleDiagnose(elevator.id, type)}
                        >
                          {FAULT_TYPE_NAMES[type]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                      提示：正确 +{100}分，错误 -{50}分
                    </p>
                  </div>
                )}

                {elevator.comfortProgress > 0 && elevator.status !== 'holding' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-[#4caf50] mb-1">
                      <span>安抚进度</span>
                      <span>{Math.floor((elevator.comfortProgress / 10) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4caf50] transition-all"
                        style={{ width: `${(elevator.comfortProgress / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 bg-[#1a2a4a] rounded-lg text-xs text-gray-400">
        <p className="font-bold text-[#ff8a00] mb-2">💡 操作说明</p>
        <p>• <span className="text-[#4caf50]">安抚乘客</span>：派遣空闲队伍安抚，恢复情绪 +30分</p>
        <p>• <span className="text-[#9c27b0]">故障诊断</span>：判断故障类型，正确 +100分，错误 -50分</p>
        <p>• <span className="text-[#2196f3]">停靠管制</span>：将电梯锁定在当前楼层，防止意外</p>
      </div>
    </div>
  );
}
