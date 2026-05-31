import type { ChangeRecord } from '../../../shared/types';
import { formatDateTime, getChangeTypeColor } from '../utils/format';
import ChangeTypeBadge from './ChangeTypeBadge';
import { User, Clock, ChevronRight } from 'lucide-react';

interface TimelineProps {
  changes: ChangeRecord[];
}

export default function Timeline({ changes }: TimelineProps) {
  const sortedChanges = [...changes].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
      
      <div className="space-y-6">
        {sortedChanges.map((change, index) => {
          const color = getChangeTypeColor(change.type);
          
          return (
            <div key={change.id} className="relative pl-12">
              <div
                className="absolute left-2 w-5 h-5 rounded-full border-4 border-white shadow-md"
                style={{ backgroundColor: color }}
              ></div>
              
              <div className="bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <ChangeTypeBadge
                        type={change.type}
                        affectsConclusion={change.affectsConclusion}
                        size="sm"
                      />
                      {change.batchRunId && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          批量运行: {change.batchRunId}
                        </span>
                      )}
                    </div>
                    
                    <p className="mt-2 text-slate-800 font-medium">{change.description}</p>
                    
                    {(change.beforeData || change.afterData) && (
                      <div className="mt-3 bg-slate-50 rounded p-3 text-sm font-mono">
                        {change.beforeData && (
                          <div className="text-red-600">
                            变更前: {JSON.stringify(change.beforeData)}
                          </div>
                        )}
                        {change.afterData && (
                          <div className="text-emerald-600 mt-1">
                            变更后: {JSON.stringify(change.afterData)}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {change.operator}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateTime(change.timestamp)}
                      </span>
                    </div>
                  </div>
                  
                  <ChevronRight className="text-slate-300 flex-shrink-0" size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {sortedChanges.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>暂无变更记录</p>
        </div>
      )}
    </div>
  );
}
