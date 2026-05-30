import { Tier, TIER_COLORS, TIER_LABELS } from '../../shared/types';
import { cn } from '../lib/utils';

interface TierBadgeProps {
  tier: Tier;
}

function TierBadge({ tier }: TierBadgeProps) {
  const color = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        tier === 'S' && 'bg-red-500/10 text-red-400',
        tier === 'A' && 'bg-orange-500/10 text-orange-400',
        tier === 'B' && 'bg-blue-500/10 text-blue-400',
        tier === 'C' && 'bg-gray-500/10 text-gray-400'
      )}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-bold">{tier}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

export { TierBadge };
