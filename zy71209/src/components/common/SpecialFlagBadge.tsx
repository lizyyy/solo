import type { SpecialFlag } from '../../types';
import { FLAG_CONFIG } from '../../utils/flagDetector';

interface SpecialFlagBadgeProps {
  flag: SpecialFlag;
  showTooltip?: boolean;
}

const flagColors: Record<SpecialFlag, string> = {
  suspended: 'bg-purple-100 text-purple-800 border-purple-300',
  supplement_pending: 'bg-orange-100 text-orange-800 border-orange-300',
  extension_old: 'bg-gray-100 text-gray-800 border-gray-300',
  extension_pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const flagIcons: Record<SpecialFlag, string> = {
  suspended: '⏸',
  supplement_pending: '⏳',
  extension_old: '📜',
  extension_pending: '⏳',
};

export function SpecialFlagBadge({ flag, showTooltip = true }: SpecialFlagBadgeProps) {
  const config = FLAG_CONFIG[flag];
  const colorClass = flagColors[flag];
  const icon = flagIcons[flag];

  const badge = (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}
    >
      <span>{icon}</span>
      <span>{config.label}</span>
    </span>
  );

  if (showTooltip) {
    return (
      <div className="relative group inline-block">
        {badge}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <div className="font-medium">{config.label}</div>
          <div className="text-gray-300 mt-1 max-w-xs">{config.suggestion}</div>
        </div>
      </div>
    );
  }

  return badge;
}

interface SpecialFlagsListProps {
  flags: SpecialFlag[];
}

export function SpecialFlagsList({ flags }: SpecialFlagsListProps) {
  if (flags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <SpecialFlagBadge key={flag} flag={flag} />
      ))}
    </div>
  );
}
