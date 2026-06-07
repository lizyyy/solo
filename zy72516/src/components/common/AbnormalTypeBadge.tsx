import { AbnormalType, AbnormalTypeLabelMap } from '../../types';

interface AbnormalTypeBadgeProps {
  type: AbnormalType;
  size?: 'sm' | 'md';
}

const abnormalColorMap: Record<AbnormalType, string> = {
  [AbnormalType.NONE]: 'bg-slate-100 text-slate-600',
  [AbnormalType.URL_404_PASSED]: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  [AbnormalType.WRONG_CRITERIA]: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300',
  [AbnormalType.REWORK_NEEDED]: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300',
  [AbnormalType.OTHER]: 'bg-purple-100 text-purple-800 ring-1 ring-purple-300'
};

export function AbnormalTypeBadge({ type, size = 'md' }: AbnormalTypeBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${sizeClass} ${abnormalColorMap[type]}`}
    >
      {AbnormalTypeLabelMap[type]}
    </span>
  );
}
