import { OperationType } from '../../types';
import { FileText, Wrench, Edit3 } from 'lucide-react';

interface OperationTypeBadgeProps {
  type: OperationType;
  affectsConclusion: boolean;
}

const typeConfig: Record<OperationType, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  threshold_early: {
    label: '阈值表早到',
    icon: FileText,
    className: 'bg-blue-900/30 text-blue-400 border-blue-700/50',
  },
  repair_late: {
    label: '维修单晚补',
    icon: Wrench,
    className: 'bg-purple-900/30 text-purple-400 border-purple-700/50',
  },
  vibration_modified: {
    label: '振动曲线手工改动',
    icon: Edit3,
    className: 'bg-orange-900/30 text-orange-400 border-orange-700/50',
  },
};

export default function OperationTypeBadge({ type, affectsConclusion }: OperationTypeBadgeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border ${config.className}`}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
      {affectsConclusion && (
        <span className="text-xs text-red-400 font-medium">
          影响结论
        </span>
      )}
    </div>
  );
}
