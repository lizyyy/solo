import { User, Clock } from 'lucide-react';
import type { ReportVersion } from '../../types';

interface VersionTimelineProps {
  versions: ReportVersion[];
}

export function VersionTimeline({ versions }: VersionTimelineProps) {
  return (
    <div className="relative">
      {versions.map((version, index) => (
        <div key={version.id} className="relative pl-8 pb-6 last:pb-0">
          {index < versions.length - 1 && (
            <div className="absolute left-3 top-6 w-0.5 h-full bg-slate-200" />
          )}
          
          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{version.version}</span>
                <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded">
                  {version.diff}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={12} />
                {version.modifyTime}
              </div>
            </div>

            {version.remarkBefore && (
              <div className="mb-2">
                <p className="text-xs text-slate-500 mb-1">修改前：</p>
                <p className="text-sm text-slate-600 bg-rose-50 px-3 py-2 rounded border border-rose-100 line-through">
                  {version.remarkBefore}
                </p>
              </div>
            )}
            
            <div>
              <p className="text-xs text-slate-500 mb-1">修改后：</p>
              <p className="text-sm text-slate-700 bg-emerald-50 px-3 py-2 rounded border border-emerald-100">
                {version.remarkAfter}
              </p>
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
              <User size={12} />
              <span>{version.modifyUser}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
