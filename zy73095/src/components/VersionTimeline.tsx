import { useReviewStore } from '@/store/reviewStore';
import { FileWarning, FileCheck, GitBranch } from 'lucide-react';

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function VersionTimeline() {
  const { versions, currentVersionTag, selectVersion } = useReviewStore();

  return (
    <div className="w-full eng-panel p-3">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-eng-border">
        <GitBranch size={14} className="text-eng-line" />
        <span className="text-sm font-medium">图纸版本时间轴</span>
      </div>

      <div className="relative pl-4 space-y-1">
        <div className="absolute left-[11px] top-1 bottom-1 w-px bg-eng-border" />

        {versions.map((v, idx) => {
          const isCurrent = v.tag === currentVersionTag;
          const hasOffset = v.coordinateOffset > 0;
          const isLatest = idx === versions.length - 1;

          return (
            <button
              key={v.tag}
              onClick={() => selectVersion(v.tag)}
              className={`relative w-full text-left pl-6 pr-2 py-2 transition-all border ${
                isCurrent
                  ? 'border-eng-warn bg-eng-panel2'
                  : 'border-transparent hover:bg-eng-panel2/60'
              }`}
              title={v.note}
            >
              <span
                className={`absolute left-[-6px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isCurrent
                    ? 'bg-eng-warn border-eng-warn'
                    : hasOffset
                    ? 'bg-eng-alert border-eng-alert'
                    : isLatest
                    ? 'bg-eng-pass border-eng-pass'
                    : 'bg-eng-panel2 border-eng-border'
                }`}
              >
                {isCurrent && (
                  <span className="absolute w-4 h-4 rounded-full bg-eng-warn animate-pulseRing" />
                )}
                {hasOffset && !isCurrent && (
                  <FileWarning size={10} className="text-white relative z-10" />
                )}
                {isLatest && !isCurrent && !hasOffset && (
                  <FileCheck size={10} className="text-white relative z-10" />
                )}
              </span>

              <div className="flex items-baseline gap-2">
                <span className={`font-mono text-xs ${isCurrent ? 'text-eng-warn' : 'text-eng-dim'}`}>
                  {v.tag.replace('v', '')}
                </span>
                <span className="text-[10px] text-eng-muted font-mono">{formatDate(v.releasedAt)}</span>
              </div>
              <div className={`text-xs mt-0.5 ${isCurrent ? 'text-eng-text' : 'text-eng-muted'}`}>
                {v.label}
                {isLatest && <span className="ml-1 eng-tag border-eng-pass text-eng-pass text-[9px]">最新</span>}
                {hasOffset && <span className="ml-1 eng-tag border-eng-alert text-eng-alert text-[9px]">坐标偏移{v.coordinateOffset}mm</span>}
              </div>
              {v.zonesWithDelta.length > 0 && (
                <div className="text-[10px] text-eng-muted mt-0.5 font-mono truncate">
                  Δ {v.zonesWithDelta.slice(0, 4).join(' ')}
                  {v.zonesWithDelta.length > 4 ? ` +${v.zonesWithDelta.length - 4}` : ''}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
