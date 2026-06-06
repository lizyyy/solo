import { User, Store, Cpu } from 'lucide-react';
import type { OperationLog } from '../types';
import { cn } from '../lib/utils';

interface TimelineProps {
  logs: OperationLog[];
}

const operatorConfig = {
  阿梅: { icon: User, color: 'text-sky-600', bg: 'bg-sky-100' },
  店长: { icon: Store, color: 'text-amber-600', bg: 'bg-amber-100' },
  系统: { icon: Cpu, color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function Timeline({ logs }: TimelineProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-medium text-gray-500 mb-6">操作记录</h3>
      <div className="relative">
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-200" />
        <div className="space-y-6">
          {logs.map((log, index) => {
            const config = operatorConfig[log.operator];
            const OperatorIcon = config.icon;
            const isLast = index === logs.length - 1;

            return (
              <div key={log.id} className="relative flex gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center z-10 flex-shrink-0',
                    config.bg
                  )}
                >
                  <OperatorIcon className={cn('w-5 h-5', config.color)} />
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-sm font-medium', config.color)}>
                      {log.operator}
                    </span>
                    <span className="text-xs text-gray-400">{log.createdAt}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {log.action}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {log.detail}
                  </p>
                </div>
                {isLast && (
                  <div className="absolute left-5 top-10 w-3 h-3 -ml-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
