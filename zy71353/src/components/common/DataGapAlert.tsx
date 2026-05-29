import { DataGaps } from '@/types';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataGapAlertProps {
  gaps: DataGaps;
  onForceImport?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function DataGapAlert({ gaps, onForceImport, onDismiss, className }: DataGapAlertProps) {
  if (!gaps.incomplete && gaps.warnings.length === 0) return null;

  const hasErrors = gaps.incomplete;
  const hasWarnings = gaps.warnings.length > 0;

  return (
    <div className={cn(
      'rounded-lg border p-4',
      hasErrors ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
      className
    )}>
      <div className="flex items-start gap-3">
        {hasErrors ? (
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1">
          <h4 className={cn(
            'font-medium mb-2',
            hasErrors ? 'text-red-800' : 'text-amber-800'
          )}>
            {hasErrors ? '数据不完整' : '数据存在警告'}
          </h4>

          {hasErrors && gaps.missingFields.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-red-700 mb-1">缺少必填字段：</p>
              <ul className="list-disc list-inside text-sm text-red-600">
                {gaps.missingFields.map((field, i) => (
                  <li key={i}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings && (
            <div>
              <p className="text-sm text-amber-700 mb-1 flex items-center gap-1">
                <Info className="w-4 h-4" />
                警告信息：
              </p>
              <ul className="list-disc list-inside text-sm text-amber-600">
                {gaps.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {gaps.forcedImport && (
            <p className="text-xs text-red-500 mt-2 italic">
              此记录为强制导入，数据可能不完整
            </p>
          )}

          {hasErrors && onForceImport && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={onForceImport}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                强制导入（不推荐）
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300 transition-colors"
                >
                  返回补充
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
