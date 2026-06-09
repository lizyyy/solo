import type { Attachment } from '../types/review';
import { formatDate } from '../utils/statusMappings';
import { FileText, Clock, Info } from 'lucide-react';

interface Props {
  attachments: Attachment[];
}

export function AttachmentList({ attachments }: Props) {

  return (
    <div className="space-y-3">
      {attachments.map((att) => (
        <div
          key={att.id}
          className={`relative rounded-lg border p-4 transition-all hover:shadow-card-hover ${
            att.isLate
              ? 'border-status-late/40 bg-status-late-bg/70'
              : 'border-slate-200 bg-white'
          }`}
        >
          {att.isLate && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-status-returned text-white px-2 py-0.5 text-[10px] font-bold shadow-sm animate-pulse-subtle">
              <Clock size={10} />
              晚到 {att.lateDays} 天
            </div>
          )}

          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                att.isLate ? 'bg-status-late/15 text-status-late' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <FileText size={18} />
            </div>
            <div className="min-w-0 flex-1 pr-16">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-900 truncate">
                  {att.fileName}
                </div>
                <span className="mono rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {att.fileNo}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  <span className="font-medium text-slate-600">应到：</span>
                  <span className="mono">{formatDate(att.expectedDate)}</span>
                </span>
                <span>
                  <span className="font-medium text-slate-600">实到：</span>
                  <span
                    className={`mono ${att.isLate ? 'font-semibold text-status-returned' : ''}`}
                  >
                    {formatDate(att.actualDate)}
                  </span>
                </span>
              </div>
              {att.impactOnConclusion && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
                  <Info size={12} className="mt-0.5 shrink-0 text-slate-400" />
                  <span className="leading-relaxed">
                    <span className="font-semibold">对结论影响：</span>
                    {att.impactOnConclusion}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
