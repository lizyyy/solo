import React from 'react';
import { OperationLog } from '../../types';
import { getOperationTypeLabel, getOperationTypeColor, formatDate } from '../../utils';
import { User, Clock, Info } from 'lucide-react';

interface TimelineProps {
  logs: OperationLog[];
}

export const Timeline: React.FC<TimelineProps> = ({ logs }) => {
  return (
    <div className="space-y-0">
      {logs.map((log, index) => (
        <div key={log.id} className="relative pl-8 pb-6">
          {index < logs.length - 1 && (
            <div className="absolute left-[11px] top-6 w-0.5 h-full bg-slate-200" />
          )}
          
          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full ${getOperationTypeColor(log.operationType)} flex items-center justify-center text-white text-xs`}>
            <Info size={12} />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-slate-800">
                  {getOperationTypeLabel(log.operationType)}
                </span>
                <p className="text-sm text-slate-600 mt-1">{log.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={12} />
                <span>{formatDate(log.operationTime)}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
              <div className="flex items-center gap-1">
                <User size={12} />
                <span>{log.operator} ({log.operatorRole})</span>
              </div>
            </div>

            {log.reason && (
              <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                <span className="font-medium">原因：</span>{log.reason}
              </div>
            )}

            {(log.beforeState || log.afterState) && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {log.beforeState && 'status' in log.beforeState && (
                  <div className="p-2 bg-amber-50 rounded">
                    <span className="text-amber-700">变更前状态：</span>
                    <span className="text-slate-700 ml-1">{String(log.beforeState.status)}</span>
                  </div>
                )}
                {log.afterState && 'status' in log.afterState && (
                  <div className="p-2 bg-emerald-50 rounded">
                    <span className="text-emerald-700">变更后状态：</span>
                    <span className="text-slate-700 ml-1">{String(log.afterState.status)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
