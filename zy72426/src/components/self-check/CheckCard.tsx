import type { SelfCheckResult } from '@/types';
import { getCheckTypeLabel } from '@/utils/selfCheckEngine';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CheckCardProps {
  result: SelfCheckResult;
  onResolve?: (issueId: string) => void;
}

const iconConfig = {
  passed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
};

export const CheckCard = ({ result, onResolve }: CheckCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const status = result.passed
    ? 'passed'
    : result.issues.some((i) => i.severity === 'error' && !i.resolved)
      ? 'failed'
      : 'warning';

  const config = iconConfig[status];
  const Icon = config.icon;
  const unresolvedCount = result.issues.filter((i) => !i.resolved).length;

  return (
    <div className={cn('rounded-sm border p-5', config.border, config.bg)}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <Icon className={cn('w-10 h-10', config.color)} />
          <div>
            <h4 className="font-semibold text-gray-800">{getCheckTypeLabel(result.checkType)}</h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {result.passed
                ? '全部通过'
                : `${unresolvedCount} 个待处理问题`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-800">
              {result.passed ? (
                <span className="text-green-600">✓</span>
              ) : (
                unresolvedCount
              )}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && result.issues.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="space-y-2">
            {result.issues.map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded',
                  issue.resolved ? 'bg-gray-100 opacity-60' : 'bg-white'
                )}
              >
                <div className="flex items-start gap-3">
                  {issue.severity === 'error' ? (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm text-gray-800">{issue.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      涉及 {issue.recordIds.length} 条记录
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!issue.resolved && (
                    <>
                      <button
                        onClick={() => navigate('/labels')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-[#1e3a5f] text-white rounded hover:bg-[#2c5282] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        处理
                      </button>
                      {onResolve && (
                        <button
                          onClick={() => onResolve(issue.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          标记解决
                        </button>
                      )}
                    </>
                  )}
                  {issue.resolved && (
                    <span className="text-xs text-green-600 font-medium">已解决</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
