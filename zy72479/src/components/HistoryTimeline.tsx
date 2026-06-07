import { HistoryLog } from '../types';
import { Clock, User, FileText, Camera, Bus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface HistoryTimelineProps {
  logs: HistoryLog[];
}

export function HistoryTimeline({ logs }: HistoryTimelineProps) {
  const getActionIcon = (action: string) => {
    if (action.includes('导入') || action.includes('照片')) {
      return <Camera className="w-4 h-4" />;
    }
    if (action.includes('公交') || action.includes('刷卡') || action.includes('补录')) {
      return <Bus className="w-4 h-4" />;
    }
    if (action.includes('冲突') || action.includes('复核')) {
      if (action.includes('确认') || action.includes('通过')) {
        return <CheckCircle className="w-4 h-4" />;
      }
      if (action.includes('驳回')) {
        return <XCircle className="w-4 h-4" />;
      }
      return <AlertTriangle className="w-4 h-4" />;
    }
    if (action.includes('待复核') || action.includes('标记')) {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('确认') || action.includes('生成') || action.includes('通过')) {
      return 'bg-success-500';
    }
    if (action.includes('驳回') || action.includes('冲突')) {
      return 'bg-danger-500';
    }
    if (action.includes('待复核') || action.includes('标记') || action.includes('补录')) {
      return 'bg-warning-500';
    }
    if (action.includes('导入') || action.includes('照片')) {
      return 'bg-primary-600';
    }
    if (action.includes('公交') || action.includes('刷卡')) {
      return 'bg-success-600';
    }
    return 'bg-gray-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Clock className="w-5 h-5 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-800">历史记录追踪</h3>
        <span className="ml-auto text-xs text-gray-500">{logs.length} 条记录</span>
      </div>
      <div className="p-5">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">暂无历史记录</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-5">
              {logs.map((log, index) => (
                <div key={log.id} className="relative pl-10">
                  <div
                    className={`absolute left-2 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${getActionColor(
                      log.action
                    )}`}
                  >
                    {getActionIcon(log.action)}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">{log.action}</h4>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {log.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{log.detail}</p>
                    <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      操作人：{log.operator}
                    </div>
                  </div>
                  {index === logs.length - 1 && (
                    <div className="absolute left-4 bottom-0 w-0.5 h-4 bg-gradient-to-b from-gray-200 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
