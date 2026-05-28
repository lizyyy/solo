import type { Member } from '../types';
import { KNOWLEDGE_POINTS, KNOWLEDGE_POINT_NAMES, KNOWLEDGE_POINT_COLORS, TRAIT_EFFECTS } from '../data/constants';

interface MemberCardProps {
  member: Member;
  selected?: boolean;
  onClick?: () => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, selected, onClick }) => {
  const fatiguePercent = (member.fatigue / member.maxFatigue) * 100;
  const isFatigueWarning = fatiguePercent >= 70;
  const isFatigueCritical = fatiguePercent >= 90;

  const getFatigueColor = () => {
    if (isFatigueCritical) return 'bg-red-500';
    if (isFatigueWarning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getFatigueStatus = () => {
    if (isFatigueCritical) return '危险';
    if (isFatigueWarning) return '警告';
    return '正常';
  };

  return (
    <div
      className={`bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border-2 transition-all duration-200 cursor-pointer card-hover ${
        selected
          ? 'border-purple-500 shadow-lg shadow-purple-500/20'
          : 'border-slate-700 hover:border-slate-600'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl">{member.avatar}</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{member.name}</h3>
          <div className="flex gap-2 mt-1">
            {member.traits.map(trait => (
              <span
                key={trait}
                className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded-full border border-purple-700"
                title={TRAIT_EFFECTS[trait]?.description}
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-400">{member.overallAbility}</div>
          <div className="text-xs text-slate-400">综合能力</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">疲劳值</span>
          <span className={`font-semibold ${isFatigueCritical ? 'text-red-400' : isFatigueWarning ? 'text-yellow-400' : 'text-green-400'}`}>
            {Math.round(member.fatigue)}/{member.maxFatigue} ({getFatigueStatus()})
          </span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getFatigueColor()} progress-bar ${isFatigueCritical ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.min(100, fatiguePercent)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {KNOWLEDGE_POINTS.slice(0, 8).map(kp => (
          <div key={kp} className="text-center">
            <div className={`text-xs font-semibold mb-1 bg-gradient-to-r ${KNOWLEDGE_POINT_COLORS[kp]} bg-clip-text text-transparent`}>
              {KNOWLEDGE_POINT_NAMES[kp]}
            </div>
            <div className="text-lg font-bold text-white">{member.knowledgePoints[kp]}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-blue-400">{member.practiceCount}</div>
          <div className="text-xs text-slate-400">刷题</div>
        </div>
        <div>
          <div className="text-lg font-bold text-purple-400">{member.reviewCount}</div>
          <div className="text-xs text-slate-400">复盘</div>
        </div>
        <div>
          <div className={`text-lg font-bold ${member.crashCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {member.crashCount}
          </div>
          <div className="text-xs text-slate-400">崩盘</div>
        </div>
      </div>

      {member.consecutivePracticeDays >= 3 && (
        <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
          ⚠️ 连续刷题{member.consecutivePracticeDays}天，效率下降中
        </div>
      )}
      {member.consecutiveRestDays >= 2 && (
        <div className="mt-2 text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
          💤 连续休息{member.consecutiveRestDays}天
        </div>
      )}
    </div>
  );
};
