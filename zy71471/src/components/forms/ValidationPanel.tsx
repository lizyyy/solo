import { useState } from 'react';
import { AlertTriangle, XCircle, ArrowRight, CheckCircle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { useValidation } from '@/hooks/useValidation';
import { useBatchStore } from '@/store/useBatchStore';
import type { ValidationError, Batch } from '@/types';
import { cn } from '@/lib/utils';

interface ValidationPanelProps {
  errors: ValidationError[];
}

export const ValidationPanel = ({ errors }: ValidationPanelProps) => {
  const { criticalErrors, warnings, totalCount } = useValidation(errors);
  const updateBatch = useBatchStore((state) => state.updateBatch);
  const currentBatch = useBatchStore((state) => state.currentBatch);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['error', 'warning']));

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const SeverityIcon = ({ severity }: { severity: 'error' | 'warning' }) => {
    const iconClass = 'w-4 h-4 flex-shrink-0';
    return severity === 'error' ? (
      <XCircle className={cn(iconClass, 'text-red-500')} />
    ) : (
      <AlertTriangle className={cn(iconClass, 'text-amber-500')} />
    );
  };

  const canAutoFix = (error: ValidationError): boolean => {
    const fixableFields = ['resistance', 'capacitance', 'initialVoltage', 'supplyVoltage', 'timeUnit', 'fitMode'];
    return fixableFields.includes(error.field);
  };

  const handleAutoFix = (error: ValidationError) => {
    if (!currentBatch) return;

    const fixes: Partial<Batch> = {};

    switch (error.field) {
      case 'resistance':
        fixes.resistance = 1;
        break;
      case 'capacitance':
        fixes.capacitance = 1;
        break;
      case 'initialVoltage':
        fixes.initialVoltage = 5;
        break;
      case 'supplyVoltage':
        fixes.supplyVoltage = 5;
        break;
      case 'timeUnit':
        fixes.timeUnit = 's';
        break;
      case 'fitMode':
        fixes.fitMode = 'discharge';
        break;
      default:
        return;
    }

    updateBatch(fixes);
  };

  const handleQuickFix = (error: ValidationError) => {
    const element = document.querySelector(`[data-field="${error.field}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
      }, 2000);
    }
  };

  const groupedErrors = {
    error: criticalErrors,
    warning: warnings,
  };

  const groupLabels = {
    error: { title: '错误', color: 'red' },
    warning: { title: '警告', color: 'amber' },
  };

  if (totalCount === 0) {
    return (
      <div className="p-8 text-center animate-fadeIn">
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-1">所有校验通过</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">数据完整且有效，可以继续进行分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">校验结果</h3>
        <div className="flex items-center gap-3">
          {criticalErrors.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <XCircle className="w-3 h-3" />
              {criticalErrors.length} 个错误
            </span>
          )}
          {warnings.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {warnings.length} 个警告
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {(Object.entries(groupedErrors) as [keyof typeof groupedErrors, ValidationError[]][]).map(
          ([severity, items]) => {
            if (items.length === 0) return null;
            const isExpanded = expandedGroups.has(severity);
            const label = groupLabels[severity];

            return (
              <div
                key={severity}
                className={cn(
                  'rounded-lg border overflow-hidden transition-all duration-200',
                  severity === 'error'
                    ? 'border-red-200 dark:border-red-900/50'
                    : 'border-amber-200 dark:border-amber-900/50'
                )}
              >
                <button
                  onClick={() => toggleGroup(severity)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 transition-colors',
                    severity === 'error'
                      ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <SeverityIcon severity={severity} />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{label.title}</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      severity === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    )}>
                      {items.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-slideDown">
                    {items.map((error) => (
                      <div
                        key={error.id}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={error.severity} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                              {error.message}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <span className="font-medium">目标:</span>
                                <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                                  {error.target}
                                </code>
                              </span>
                              <ArrowRight className="w-3 h-3" />
                              <span>{error.suggestion}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {canAutoFix(error) && (
                              <button
                                onClick={() => handleAutoFix(error)}
                                className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100',
                                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                )}
                              >
                                <Wrench className="w-3 h-3" />
                                一键修复
                              </button>
                            )}
                            <button
                              onClick={() => handleQuickFix(error)}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100',
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                              )}
                            >
                              <ArrowRight className="w-3 h-3" />
                              定位
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};
