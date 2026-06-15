import { User, Clock, Info } from 'lucide-react';
import type { ReportVersion } from '../../types';

interface VersionTimelineProps {
  versions: ReportVersion[];
}

export function VersionTimeline({ versions }: VersionTimelineProps) {
  const sorted = [...versions].sort((a, b) =>
    a.modifyTime.localeCompare(b.modifyTime) || a.version.localeCompare(b.version)
  );

  return (
    <div className="relative">
      {sorted.map((version, index) => {
        const isStatusChange = version.diff === '状态变化说明';
        const isInitial = version.diff === '创建初始版本';
        const isReview = version.diff === '复核通过' || version.diff === '复核驳回';

        return (
          <div key={version.id} className="relative pl-8 pb-6 last:pb-0">
            {index < sorted.length - 1 && (
              <div className="absolute left-3 top-6 w-0.5 h-full bg-slate-200" />
            )}

            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${
              isStatusChange
                ? 'bg-amber-50 border-2 border-amber-400'
                : isReview
                ? 'bg-sky-50 border-2 border-sky-400'
                : isInitial
                ? 'bg-emerald-50 border-2 border-emerald-400'
                : 'bg-white border-2 border-slate-300'
            }`}>
              {isStatusChange ? (
                <div className="w-2 h-2 rounded-full bg-amber-400" />
              ) : isReview ? (
                <div className="w-2 h-2 rounded-full bg-sky-400" />
              ) : isInitial ? (
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-400" />
              )}
            </div>

            <div className={`rounded-lg p-4 border ${
              isStatusChange
                ? 'bg-amber-50 border-amber-100'
                : isReview
                ? 'bg-sky-50 border-sky-100'
                : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{version.version}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    isStatusChange
                      ? 'bg-amber-200 text-amber-700'
                      : isReview
                      ? 'bg-sky-200 text-sky-700'
                      : isInitial
                      ? 'bg-emerald-200 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {version.diff}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} />
                  {version.modifyTime}
                </div>
              </div>

              {isStatusChange ? (
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 leading-relaxed">{version.remarkAfter}</p>
                </div>
              ) : (
                <>
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
                </>
              )}

              <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                <User size={12} />
                <span>{version.modifyUser}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
