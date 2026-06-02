import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { getSelfCheckStatusColor } from '@/utils/format';
import { cn } from '@/lib/utils';

export function SelfCheckPanel() {
  const [expanded, setExpanded] = useState(true);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const { selfCheckResults, selfCheckRunning, runSelfCheck } = useDashboardStore();

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div 
        className="flex cursor-pointer items-center justify-between border-b border-gray-100 p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">数据自检</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {selfCheckResults.length} 项检查
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              runSelfCheck();
            }}
            disabled={selfCheckRunning}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', selfCheckRunning && 'animate-spin')} />
            运行自检
          </button>
          {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4">
          {selfCheckResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p>点击"运行自检"按钮开始检查数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selfCheckResults.map((result) => (
                <div key={result.checkType} className="rounded-lg border border-gray-100">
                  <div 
                    className="flex cursor-pointer items-center justify-between p-3 hover:bg-gray-50"
                    onClick={() => setExpandedCheck(expandedCheck === result.checkType ? null : result.checkType)}
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(result.status)}
                      <div>
                        <p className="font-medium text-gray-900">{result.checkName}</p>
                        <p className="text-xs text-gray-500">
                          共 {result.total} 条，异常 {result.abnormal} 条
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div 
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              result.status === 'pass' && 'bg-green-500',
                              result.status === 'warning' && 'bg-yellow-500',
                              result.status === 'error' && 'bg-red-500'
                            )}
                            style={{ width: `${Math.max(0, ((result.total - result.abnormal) / result.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                      {expandedCheck === result.checkType ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {expandedCheck === result.checkType && result.details.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 p-3">
                      <div className="space-y-2">
                        {result.details.map((detail, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded bg-white p-2 text-sm">
                            <span className={cn(
                              'mt-0.5 h-2 w-2 flex-shrink-0 rounded-full',
                              detail.severity === 'high' && 'bg-red-500',
                              detail.severity === 'medium' && 'bg-yellow-500',
                              detail.severity === 'low' && 'bg-blue-500'
                            )} />
                            <div>
                              <p className="text-gray-700">{detail.message}</p>
                              {detail.institutionCode && (
                                <p className="text-xs text-gray-400">机构代码: {detail.institutionCode}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
