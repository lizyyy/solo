import type { AnomalyEvent } from '../types';
import { Zap, ShieldAlert, Wallet } from 'lucide-react';

interface Props {
  anomalies: AnomalyEvent[];
}

const typeIcons = {
  impulsive_bid: Zap,
  reserve_misjudgment: ShieldAlert,
  budget_overrun: Wallet,
};

const typeLabels = {
  impulsive_bid: '冲动加价',
  reserve_misjudgment: '保留价误判',
  budget_overrun: '预算透支',
};

const severityColors = [
  '',
  'text-[#c9a84c] bg-[#c9a84c]/10',
  'text-[#c9a84c] bg-[#c9a84c]/10',
  'text-[#8b2252] bg-[#8b2252]/10',
  'text-[#8b2252] bg-[#8b2252]/10',
  'text-[#8b2252] bg-[#8b2252]/15',
];

export default function AnomalyBadge({ anomalies }: Props) {
  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[#8b2252]">
        <ShieldAlert className="w-4 h-4" />
        <span className="text-sm font-bold">异常事件</span>
        <span className="px-2 py-0.5 bg-[#8b2252]/20 text-[#8b2252] text-xs rounded-full">{anomalies.length}</span>
      </div>
      {anomalies.map((a, i) => {
        const Icon = typeIcons[a.anomalyType];
        return (
          <div key={i} className="bg-[#8b2252]/5 border border-[#8b2252]/20 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-[#8b2252]" />
                <span className="text-xs font-medium text-[#8b2252]">{typeLabels[a.anomalyType]}</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <div
                    key={s}
                    className={`w-1.5 h-1.5 rounded-full ${s < a.severity ? 'bg-[#8b2252]' : 'bg-[#8b2252]/20'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-[#f5f0e8]/60 text-xs leading-relaxed">{a.description}</p>
          </div>
        );
      })}
    </div>
  );
}
