import type { ConflictLog } from '../types';
import { AlertTriangle } from 'lucide-react';

interface Props {
  conflicts: ConflictLog[];
}

const typeLabels: Record<ConflictLog['conflictType'], string> = {
  estimate_vs_description: '估价↔描述',
  collector_vs_estimate: '藏家↔估价',
  collector_vs_description: '藏家↔描述',
};

export default function ConflictAlert({ conflicts }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[#c9a84c]">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-bold">信息冲突留痕</span>
        <span className="px-2 py-0.5 bg-[#c9a84c]/20 text-[#c9a84c] text-xs rounded-full">{conflicts.length}</span>
      </div>
      {conflicts.map((c, i) => (
        <div key={i} className="bg-[#c9a84c]/5 border border-[#c9a84c]/20 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#c9a84c]/15 text-[#c9a84c] text-xs rounded font-medium">
              {typeLabels[c.conflictType]}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${c.resolution === 'deferred' ? 'bg-[#f5f0e8]/10 text-[#f5f0e8]/50' : 'bg-[#c9a84c]/10 text-[#c9a84c]/70'}`}>
              {c.resolution === 'deferred' ? '待判断' : '玩家判断'}
            </span>
          </div>
          <p className="text-[#f5f0e8]/60 text-xs leading-relaxed">{c.description}</p>
        </div>
      ))}
    </div>
  );
}
