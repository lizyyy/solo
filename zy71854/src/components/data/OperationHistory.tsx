import React from 'react';
import { OperationLog } from '@/types';
import { actionToText, dataTypeToText } from '@/utils/processing';
import { Clock, User, FileText, Wrench, StickyNote, Lightbulb, ArrowUndo } from 'lucide-react';

interface OperationHistoryProps {
  logs: OperationLog[];
}

export const OperationHistory: React.FC<OperationHistoryProps> = ({ logs }) => {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'undo':
        return ArrowUndo;
      default:
        return Clock;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'script':
        return FileText;
      case 'part':
        return Wrench;
      case 'note':
        return StickyNote;
      case 'knowledge':
        return Lightbulb;
      default:
        return FileText;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'import':
        return 'text-blue-600 bg-blue-50';
      case 'edit':
        return 'text-amber-600 bg-amber-50';
      case 'undo':
        return 'text-slate-600 bg-slate-50';
      case 'export':
        return 'text-green-600 bg-green-50';
      case 'status_change':
        return 'text-purple-600 bg-purple-50';
      case 'skip':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="card">
      <h3 className="font-serif font-semibold text-graphite mb-4">操作历史</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin pr-2">
        {logs.length === 0 ? (
          <p className="text-center text-graphite-light py-8">暂无操作记录</p>
        ) : (
          logs.map((log) => {
            const ActionIcon = getActionIcon(log.action);
            const TypeIcon = getTypeIcon(log.targetType);
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActionColor(log.action)}`}>
                  <ActionIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                      {actionToText(log.action)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700">
                      <TypeIcon size={12} />
                      {dataTypeToText(log.targetType)}
                    </span>
                  </div>
                  <p className="text-sm text-graphite truncate">{log.processingRule}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-graphite-light">
                    <User size={12} />
                    <span>{log.operator}</span>
                    <span>·</span>
                    <Clock size={12} />
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
