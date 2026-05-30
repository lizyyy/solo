import React from 'react';
import { Clock, User, FileText, ChevronRight, Download, Trash2, Edit2, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { OperationLog } from '@/types';

interface OperationLogListProps {
  logs: OperationLog[];
}

const actionIcons: Record<string, React.ReactNode> = {
  '创建批次': <FileText className="w-4 h-4" />,
  '导入材料': <Download className="w-4 h-4" />,
  '材料更新': <Edit2 className="w-4 h-4" />,
  '删除材料': <Trash2 className="w-4 h-4" />,
  '条款解析完成': <FileText className="w-4 h-4" />,
  '档位试算完成': <Calculator className="w-4 h-4" />,
  '复核校验完成': <CheckCircle className="w-4 h-4" />,
  '兑付方案生成完成': <FileText className="w-4 h-4" />,
  '人工修正条款解析': <Edit2 className="w-4 h-4" />,
};

const getActionIcon = (action: string) => {
  for (const [key, icon] of Object.entries(actionIcons)) {
    if (action.includes(key)) return icon;
  }
  if (action.includes('解决问题')) return <AlertTriangle className="w-4 h-4" />;
  return <ChevronRight className="w-4 h-4" />;
};

const getActionColor = (action: string) => {
  if (action.includes('删除') || action.includes('错误')) return 'text-red-600 bg-red-100';
  if (action.includes('更新') || action.includes('修正')) return 'text-yellow-600 bg-yellow-100';
  if (action.includes('完成') || action.includes('创建') || action.includes('导入')) return 'text-green-600 bg-green-100';
  if (action.includes('解决')) return 'text-blue-600 bg-blue-100';
  return 'text-gray-600 bg-gray-100';
};

export const OperationLogList: React.FC<OperationLogListProps> = ({ logs }) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">暂无操作日志</p>
        <p className="text-xs text-gray-400 mt-1">所有操作将在此处记录，用于审计追踪</p>
      </div>
    );
  }

  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center">
            <Clock className="w-4 h-4 mr-2 text-primary-500" />
            操作日志
          </CardTitle>
          <Badge variant="neutral" size="sm">
            {logs.length} 条记录
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {sortedLogs.map((log, idx) => (
              <div key={log.id} className="relative pl-10">
                <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <span className="text-xs text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    <span>{log.operator}</span>
                    <span className="text-gray-300">|</span>
                    <span>操作ID: {log.id}</span>
                  </div>
                  {log.beforeValue && log.afterValue && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {log.beforeValue !== null && (
                        <div className="p-2 bg-red-50 rounded border border-red-100">
                          <p className="text-red-600 font-medium mb-1">变更前</p>
                          <pre className="text-xs text-red-700 overflow-auto max-h-20 font-mono">
                            {typeof log.beforeValue === 'object'
                              ? JSON.stringify(log.beforeValue, null, 1)
                              : String(log.beforeValue)}
                          </pre>
                        </div>
                      )}
                      {log.afterValue !== null && (
                        <div className="p-2 bg-green-50 rounded border border-green-100">
                          <p className="text-green-600 font-medium mb-1">变更后</p>
                          <pre className="text-xs text-green-700 overflow-auto max-h-20 font-mono">
                            {typeof log.afterValue === 'object'
                              ? JSON.stringify(log.afterValue, null, 1)
                              : String(log.afterValue)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
OperationLogList.displayName = 'OperationLogList';
