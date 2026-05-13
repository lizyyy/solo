import React from 'react';
import type { BusinessPhase } from '../types';

interface PhaseNavigatorProps {
  currentPhase: BusinessPhase;
  onAdvance: () => void;
  canAdvanceToNext: boolean;
  advanceBlockReason?: string;
}

const phases: { key: BusinessPhase; label: string; desc: string }[] = [
  { key: 'preparation', label: '准备阶段', desc: '录入楼栋和住户信息' },
  { key: 'signing', label: '签字阶段', desc: '收集住户同意签字' },
  { key: 'publicity', label: '公示阶段', desc: '方案公示与意见收集' },
  { key: 'implementation', label: '实施阶段', desc: '电梯安装施工' },
  { key: 'completed', label: '已完成', desc: '项目验收完成' },
];

export const PhaseNavigator: React.FC<PhaseNavigatorProps> = ({
  currentPhase,
  onAdvance,
  canAdvanceToNext,
  advanceBlockReason,
}) => {
  const currentIndex = phases.findIndex(p => p.key === currentPhase);
  const canAdvance = currentIndex < phases.length - 1;
  const nextPhase = canAdvance ? phases[currentIndex + 1] : null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">业务进度</h2>
      
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${(currentIndex / (phases.length - 1)) * 100}%` }}
          />
        </div>

        <div className="flex justify-between relative">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <div key={phase.key} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold z-10 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div className="mt-3 text-center">
                  <div className={`text-sm font-medium ${
                    isCompleted || isCurrent ? 'text-gray-800' : 'text-gray-400'
                  }`}>
                    {phase.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 max-w-20">
                    {phase.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canAdvance && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">下一阶段</div>
              <div className="font-semibold text-gray-800">{nextPhase?.label}</div>
              {!canAdvanceToNext && advanceBlockReason && (
                <div className="text-sm text-red-500 mt-1">{advanceBlockReason}</div>
              )}
            </div>
            <button
              onClick={onAdvance}
              disabled={!canAdvanceToNext}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                canAdvanceToNext
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              推进到下一阶段
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
