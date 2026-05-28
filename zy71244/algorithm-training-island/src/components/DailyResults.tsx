import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ACTIVITY_NAMES, KNOWLEDGE_POINT_NAMES, ACTIVITY_COLORS } from '../data/constants';
import type { ActivityResult } from '../types';

export const DailyResults: React.FC = () => {
  const { state, getMemberById } = useGame();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysWithResults = Array.from(
    new Set(state.activityResults.map(r => r.day))
  ).sort((a, b) => b - a);

  const getDayResults = (day: number): ActivityResult[] => {
    return state.activityResults.filter(r => r.day === day);
  };

  const formatAbilityChange = (change: number): string => {
    if (change > 0) return `+${change}`;
    if (change < 0) return `${change}`;
    return '0';
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">📜 训练日志</h2>

      {daysWithResults.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-2">📝</div>
          <p>还没有训练记录</p>
          <p className="text-sm">完成第一天训练后查看日志</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 mb-4">
            {daysWithResults.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedDay === day
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                }`}
              >
                第 {day} 天
              </button>
            ))}
          </div>

          {selectedDay && (
            <div className="space-y-3 animate-slide-in">
              {getDayResults(selectedDay).map((result, idx) => {
                const member = getMemberById(result.memberId);
                const hasAbilityGain = Object.values(result.abilityChange).some(v => v > 0);
                
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      result.isCrash
                        ? 'bg-red-900/30 border-red-700 animate-shake'
                        : result.success
                        ? 'bg-green-900/20 border-green-700'
                        : 'bg-yellow-900/20 border-yellow-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{member?.avatar}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">
                            {member?.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTIVITY_COLORS[result.type]}`}>
                            {ACTIVITY_NAMES[result.type]}
                          </span>
                          {result.isCrash && (
                            <span className="badge badge-danger">崩盘!</span>
                          )}
                          {!result.isCrash && result.success && (
                            <span className="badge badge-success">成功</span>
                          )}
                          {!result.isCrash && !result.success && (
                            <span className="badge badge-warning">部分成功</span>
                          )}
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-2">{result.message}</p>
                        
                        <div className="flex flex-wrap gap-3 text-sm">
                          <div className={`font-medium ${result.fatigueChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            疲劳: {result.fatigueChange > 0 ? '+' : ''}{result.fatigueChange}
                          </div>
                          
                          {hasAbilityGain && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(result.abilityChange)
                                .filter(([_, v]) => v > 0)
                                .map(([kp, v]) => (
                                  <span key={kp} className="text-green-400">
                                    {KNOWLEDGE_POINT_NAMES[kp as keyof typeof KNOWLEDGE_POINT_NAMES]}: +{v}
                                  </span>
                                ))}
                            </div>
                          )}
                          
                          {result.overallAbilityChange !== 0 && (
                            <div className="text-purple-400">
                              综合能力: {formatAbilityChange(result.overallAbilityChange)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!selectedDay && (
            <div className="text-center py-8 text-slate-400">
              <p>选择日期查看当日训练详情</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-400">
            {state.activityResults.filter(r => r.success && !r.isCrash).length}
          </div>
          <div className="text-sm text-slate-400">成功活动</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-400">
            {state.activityResults.filter(r => !r.success && !r.isCrash).length}
          </div>
          <div className="text-sm text-slate-400">部分成功</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-400">
            {state.activityResults.filter(r => r.isCrash).length}
          </div>
          <div className="text-sm text-slate-400">崩盘次数</div>
        </div>
      </div>
    </div>
  );
};
