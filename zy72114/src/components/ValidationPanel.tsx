import { cn } from '@/lib/utils';
import type { ValidationIssue, Severity } from '../types';

interface ValidationPanelProps {
  issues: ValidationIssue[];
  onLocate?: (recordId?: string, field?: string) => void;
}

const severityConfig: Record<Severity, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
  icon: string;
}> = {
  error: {
    label: '错误',
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-300',
    dotColor: 'bg-danger-500',
    icon: '✕',
  },
  warning: {
    label: '警告',
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-300',
    dotColor: 'bg-warning-500',
    icon: '⚠',
  },
  info: {
    label: '提示',
    bgColor: 'bg-blueprint-50',
    textColor: 'text-blueprint-700',
    borderColor: 'border-blueprint-300',
    dotColor: 'bg-blueprint-500',
    icon: 'ℹ',
  },
};

function IssueItem({
  issue,
  onLocate,
  index,
}: {
  issue: ValidationIssue;
  onLocate?: (recordId?: string, field?: string) => void;
  index: number;
}) {
  const config = severityConfig[issue.severity];

  return (
    <div
      className={cn(
        'eng-card p-4 border-l-4 cursor-pointer',
        'hover:translate-x-1 transition-transform duration-200',
        'opacity-0 animate-slide-in-right',
        config.bgColor
      )}
      style={{
        borderLeftColor: issue.severity === 'error' ? '#EF4444' : issue.severity === 'warning' ? '#F97316' : '#3B82F6',
        animationDelay: `${index * 0.08}s`,
      }}
      onClick={() => onLocate?.(issue.recordId, issue.field)}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center text-sm font-bold flex-shrink-0',
            config.textColor,
            `bg-${issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'blueprint'}-100`
          )}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'eng-badge text-xs',
                config.bgColor,
                config.textColor,
                config.borderColor
              )}
            >
              {config.label}
            </span>
            <span className="text-xs text-ink-500 font-mono">
              {issue.field}
            </span>
          </div>
          <p className="text-sm text-ink-800 mb-2 font-medium">
            {issue.message}
          </p>
          <p className="text-xs text-ink-600 flex items-center gap-1">
            <span className="text-safe-600">💡</span>
            {issue.suggestion}
          </p>
          {issue.recordId && (
            <div className="mt-2 flex items-center gap-1 text-xs text-ink-400">
              <span>📍</span>
              <span className="font-mono truncate">
                点击定位到对应记录
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ValidationPanel({ issues, onLocate }: ValidationPanelProps) {
  const groupedIssues = {
    error: issues.filter((i) => i.severity === 'error'),
    warning: issues.filter((i) => i.severity === 'warning'),
    info: issues.filter((i) => i.severity === 'info'),
  };

  const totalCount = issues.length;
  const errorCount = groupedIssues.error.length;
  const warningCount = groupedIssues.warning.length;

  if (totalCount === 0) {
    return (
      <div className="eng-card p-8">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-safe-100 flex items-center justify-center mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-lg font-bold text-ink-800 mb-2">
            数据校验通过
          </h3>
          <p className="text-sm text-ink-500">
            太棒了！所有数据都没有问题，可以继续下一步操作
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="eng-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="eng-section-title mb-0 border-b-0 pb-0">
              <span>🔍</span>
              校验问题
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-danger-100 rounded">
                <span className="status-dot-danger"></span>
                <span className="text-sm font-bold text-danger-700">
                  {errorCount} 个错误
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-warning-100 rounded">
                <span className="status-dot-warning"></span>
                <span className="text-sm font-bold text-warning-700">
                  {warningCount} 个警告
                </span>
              </div>
            )}
            <div className="text-sm text-ink-500">
              共 {totalCount} 个问题
            </div>
          </div>
        </div>
      </div>

      {(['error', 'warning', 'info'] as Severity[]).map((severity) => {
        const group = groupedIssues[severity];
        if (group.length === 0) return null;

        const config = severityConfig[severity];

        return (
          <div key={severity} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn('status-dot', config.dotColor)}></div>
              <span className={cn('text-sm font-bold', config.textColor)}>
                {config.label} ({group.length})
              </span>
            </div>
            <div className="space-y-3">
              {group.map((issue, index) => (
                <IssueItem
                  key={issue.id}
                  issue={issue}
                  onLocate={onLocate}
                  index={index}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
