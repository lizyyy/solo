import { getChangeTypeLabel, getChangeTypeColor } from '../utils/format';

interface ChangeTypeBadgeProps {
  type: string;
  affectsConclusion?: boolean;
  size?: 'sm' | 'md';
}

export default function ChangeTypeBadge({ type, affectsConclusion, size = 'md' }: ChangeTypeBadgeProps) {
  const label = getChangeTypeLabel(type);
  const color = getChangeTypeColor(type);
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center font-medium border-2 rounded ${sizeClass}`}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}60`,
        color: color,
      }}
    >
      <span
        className="w-2 h-2 rounded-full mr-2"
        style={{ backgroundColor: color }}
      ></span>
      {label}
      {affectsConclusion !== undefined && (
        <span className="ml-2 text-xs opacity-75">
          {affectsConclusion ? '[改结论]' : '[补材料]'}
        </span>
      )}
    </span>
  );
}
