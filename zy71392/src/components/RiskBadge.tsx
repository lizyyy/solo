interface Props { score: number; size?: 'sm' | 'md' }

export default function RiskBadge({ score, size = 'md' }: Props) {
  const color = score >= 70 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                score >= 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  const label = score >= 70 ? '高风险' : score >= 40 ? '中风险' : '低风险';
  const sz = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`badge border ${color} ${sz}`}>
      {label} {score}
    </span>
  );
}
