import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getIssueSummary } from '@/engine/validator';
import { ISSUE_TYPE_LABELS, type IssueType } from '@/types';
import { cn } from '@/lib/utils';

const CARD_CONFIG: {
  type: IssueType;
  reminder: string;
  icon: typeof AlertTriangle;
}[] = [
  {
    type: 'null_value',
    reminder: '空值字段将无法参与完整优化计算',
    icon: AlertCircle,
  },
  {
    type: 'duplicate',
    reminder: '重复录入数据会干扰统计结果',
    icon: AlertCircle,
  },
  {
    type: 'out_of_bounds',
    reminder: '越界样本需人工核实是否排除',
    icon: AlertTriangle,
  },
  {
    type: 'unit_mismatch',
    reminder: '建议统一录入单位以减少换算误差',
    icon: Info,
  },
  {
    type: 'weight_unclosed',
    reminder: '权重之和须等于1才能正确计算',
    icon: AlertTriangle,
  },
];

const SEVERITY_MAP: Record<IssueType, 'error' | 'warning' | 'info'> = {
  null_value: 'warning',
  duplicate: 'warning',
  out_of_bounds: 'error',
  unit_mismatch: 'info',
  weight_unclosed: 'error',
};

function getAccent(count: number, severity: 'error' | 'warning' | 'info') {
  if (count > 0 && severity === 'error') return 'border-l-red-500';
  if (count > 0 && severity === 'warning') return 'border-l-yellow-500';
  return 'border-l-gray-300';
}

function getIconColor(count: number, severity: 'error' | 'warning' | 'info') {
  if (count > 0 && severity === 'error') return 'text-red-500';
  if (count > 0 && severity === 'warning') return 'text-yellow-500';
  return 'text-gray-400';
}

export default function QualityDashboard() {
  const issues = useStore((s) => s.issues);
  const summary = getIssueSummary(issues);

  return (
    <div>
      <div
        className="rounded-t-lg px-5 py-3 text-white text-base font-semibold tracking-wide"
        style={{ backgroundColor: '#0F4C5C' }}
      >
        数据质量概览
      </div>
      <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 rounded-b-lg">
        {CARD_CONFIG.map((cfg) => {
          const count = summary[cfg.type];
          const severity = SEVERITY_MAP[cfg.type];
          const Icon = cfg.icon;
          return (
            <div
              key={cfg.type}
              className={cn(
                'rounded-lg bg-white shadow-sm p-4 border-l-4',
                getAccent(count, severity),
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon
                  className={cn('w-5 h-5', getIconColor(count, severity))}
                />
                <span
                  className={cn(
                    'text-3xl font-mono font-bold',
                    count > 0 && severity === 'error'
                      ? 'text-red-600'
                      : count > 0 && severity === 'warning'
                        ? 'text-yellow-600'
                        : 'text-gray-800',
                  )}
                >
                  {count}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-700">
                {ISSUE_TYPE_LABELS[cfg.type]}
              </div>
              <div className="text-xs text-gray-400 mt-1 leading-snug">
                {cfg.reminder}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
