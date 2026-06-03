import { Clock, User, FileText, RotateCcw, Edit, CheckCircle, AlertTriangle } from 'lucide-react';
import type { AuditLog, AuditActionType } from '../../shared/types';
import { formatDate } from '../../shared/utils/formatters';
import { cn } from '../lib/utils';

const ACTION_ICONS: Record<AuditActionType, typeof FileText> = {
  IMPORT: FileText,
  EDIT: Edit,
  STATUS_CHANGE: CheckCircle,
  REVIEW: CheckCircle,
  CORRECT: Edit,
  ROLLBACK: RotateCcw,
};

const ACTION_LABELS: Record<AuditActionType, string> = {
  IMPORT: '导入',
  EDIT: '编辑',
  STATUS_CHANGE: '状态变更',
  REVIEW: '复核',
  CORRECT: '修正',
  ROLLBACK: '回滚',
};

const ACTION_COLORS: Record<AuditActionType, string> = {
  IMPORT: 'text-blue-400',
  EDIT: 'text-amber-400',
  STATUS_CHANGE: 'text-emerald-400',
  REVIEW: 'text-emerald-400',
  CORRECT: 'text-amber-400',
  ROLLBACK: 'text-purple-400',
};

interface AuditTrailProps {
  logs: AuditLog[];
  title?: string;
}

export function AuditTrail({ logs, title = '审计追踪' }: AuditTrailProps) {
  if (logs.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="text-center py-8 text-slate-400">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>暂无审计记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-slate-400" />
        {title}
        <span className="text-sm font-normal text-slate-400 ml-2">共 {logs.length} 条记录</span>
      </h3>
      
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-700" />
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {logs.map((log, index) => {
            const Icon = ACTION_ICONS[log.actionType];
            return (
              <div key={log.id} className="relative pl-10">
                <div className={cn(
                  'absolute left-2 w-5 h-5 rounded-full border-2 border-slate-800 flex items-center justify-center',
                  log.actionType === 'ROLLBACK' ? 'bg-purple-500' :
                  log.actionType === 'CORRECT' || log.actionType === 'EDIT' ? 'bg-amber-500' :
                  log.actionType === 'IMPORT' ? 'bg-blue-500' : 'bg-emerald-500'
                )}>
                  <Icon className="h-3 w-3 text-white" />
                </div>
                
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium', ACTION_COLORS[log.actionType])}>
                        {ACTION_LABELS[log.actionType]}
                      </span>
                      {log.originalLineNumber !== null && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-sm">
                          原始行号: {log.originalLineNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.operator}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                  </div>
                  
                  {log.remark && (
                    <p className="text-sm text-slate-300 mb-2">{log.remark}</p>
                  )}
                  
                  {log.originalValue && log.newValue && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-red-900/20 border border-red-900/30 rounded p-2">
                        <div className="text-red-400 font-medium mb-1">变更前</div>
                        <div className="text-slate-400 font-mono break-all">
                          {log.originalValue.length > 100 
                            ? log.originalValue.substring(0, 100) + '...' 
                            : log.originalValue}
                        </div>
                      </div>
                      <div className="bg-emerald-900/20 border border-emerald-900/30 rounded p-2">
                        <div className="text-emerald-400 font-medium mb-1">变更后</div>
                        <div className="text-slate-400 font-mono break-all">
                          {log.newValue.length > 100 
                            ? log.newValue.substring(0, 100) + '...' 
                            : log.newValue}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
