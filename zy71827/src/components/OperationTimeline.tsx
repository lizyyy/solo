import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, User, Calendar, ArrowRight } from 'lucide-react';
import { cn, formatDate } from '@/utils/helpers';
import type { OperationLog, ActionType } from '@/types';

interface OperationTimelineProps {
  logs: OperationLog[];
  className?: string;
}

const actionColors: Record<ActionType, string> = {
  create: 'bg-green-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  import: 'bg-purple-500',
  export: 'bg-amber-500',
};

const actionLabels: Record<ActionType, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  import: '导入',
  export: '导出',
};

interface LogItemProps {
  log: OperationLog;
  isLast: boolean;
}

function LogItem({ log, isLast }: LogItemProps) {
  const [expanded, setExpanded] = useState(false);

  const parseData = (data: string) => {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  };

  const beforeData = parseData(log.beforeData);
  const afterData = parseData(log.afterData);
  const hasDataDiff = log.beforeData !== log.afterData && log.beforeData !== '{}';

  return (
    <div className="relative pl-8">
      {!isLast && (
        <div className="absolute left-[7px] top-6 bottom-0 w-px bg-slate-200" />
      )}
      
      <div className={cn(
        'absolute left-0 top-2 w-4 h-4 rounded-full border-2 border-white shadow-sm',
        actionColors[log.action]
      )} />

      <div className="pb-6">
        <div
          onClick={() => hasDataDiff && setExpanded(!expanded)}
          className={cn(
            'bg-white rounded-lg border border-slate-200 p-4 transition-all',
            hasDataDiff && 'cursor-pointer hover:border-slate-300 hover:shadow-sm'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full text-white',
                  actionColors[log.action]
                )}>
                  {actionLabels[log.action]}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {log.remark}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {log.operator}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(log.createdAt)}
                </span>
              </div>
            </div>

            {hasDataDiff && (
              <button className="p-1 hover:bg-slate-100 rounded transition-colors">
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            )}
          </div>

          <AnimatePresence>
            {expanded && hasDataDiff && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">变更前</p>
                      <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-x-auto text-slate-600 max-h-40 overflow-y-auto">
                        {typeof beforeData === 'object'
                          ? JSON.stringify(beforeData, null, 2)
                          : beforeData}
                      </pre>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10">
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </div>
                      <p className="text-xs font-medium text-slate-500 mb-2">变更后</p>
                      <pre className="text-xs bg-sky-50 rounded-lg p-3 overflow-x-auto text-slate-700 max-h-40 overflow-y-auto">
                        {typeof afterData === 'object'
                          ? JSON.stringify(afterData, null, 2)
                          : afterData}
                      </pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function OperationTimeline({ logs, className }: OperationTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className={cn('text-center py-8 text-slate-500', className)}>
        暂无操作记录
      </div>
    );
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className={cn('relative', className)}>
      {sortedLogs.map((log, index) => (
        <LogItem
          key={log.id}
          log={log}
          isLast={index === sortedLogs.length - 1}
        />
      ))}
    </div>
  );
}
