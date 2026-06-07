import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Copy, AlertTriangle, RefreshCw, FileCheck } from 'lucide-react';
import { getCheckItemLabel } from '@/utils/selfChecker';

interface CheckItemCardProps {
  checkKey: string;
  passed: boolean;
  details: string;
}

const iconMap: Record<string, typeof Copy> = {
  duplicateImport: Copy,
  missingFeatures: AlertTriangle,
  recalculation: RefreshCw,
  exportConsistency: FileCheck,
};

export const CheckItemCard = ({ checkKey, passed, details }: CheckItemCardProps) => {
  const Icon = iconMap[checkKey] || CheckCircle;

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-5 transition-all duration-200',
        passed
          ? 'bg-green-50 border-green-200 hover:border-green-300'
          : 'bg-red-50 border-red-200 hover:border-red-300'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            passed ? 'bg-green-500' : 'bg-red-500'
          )}
        >
          {passed ? (
            <CheckCircle className="w-6 h-6 text-white" />
          ) : (
            <XCircle className="w-6 h-6 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <Icon className={cn('w-5 h-5', passed ? 'text-green-600' : 'text-red-600')} />
            <h4
              className={cn('font-semibold', passed ? 'text-green-900' : 'text-red-900')}
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              {getCheckItemLabel(checkKey)}
            </h4>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
              )}
            >
              {passed ? '通过' : '未通过'}
            </span>
          </div>
          <p className={cn('text-sm', passed ? 'text-green-700' : 'text-red-700')}>
            {details}
          </p>
        </div>
      </div>
    </div>
  );
};
