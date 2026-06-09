import { X, ArrowRight, User, CalendarDays, Clock3, BookmarkCheck } from 'lucide-react';
import { useReviewStore } from '@/store/reviewStore';
import { STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS, type HistoryEvent } from '@/types';

function EventBlock({ e, onJump }: { e: HistoryEvent; onJump: (v: string) => void }) {
  const changed = e.oldConclusion !== e.newConclusion;
  return (
    <div className="relative pl-6 pb-4 last:pb-0">
      <div className="absolute left-[5px] top-1 bottom-0 w-px bg-eng-border last:hidden" />
      <div
        className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 ${
          changed ? 'bg-eng-warn border-eng-warn' : 'bg-eng-pass border-eng-pass'
        }`}
      />

      <div className="eng-panel p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-eng-warn">{e.zoneId}</span>
              <span className="text-[10px] font-mono text-eng-muted border border-eng-border px-1.5 py-0.5">
                {e.relatedVersionTag}
              </span>
              {changed ? (
                <span className="eng-tag border-eng-warn text-eng-warn text-[10px]">
                  <Clock3 size={10} className="inline mr-0.5" /> 改判
                </span>
              ) : (
                <span className="eng-tag border-eng-pass text-eng-pass text-[10px]">
                  <BookmarkCheck size={10} className="inline mr-0.5" /> 补材不改判
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-eng-muted mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <CalendarDays size={10} /> {new Date(e.at).toLocaleString('zh-CN', { hour12: false })}
              </span>
              <span className="flex items-center gap-1">
                <User size={10} /> {e.operator}
              </span>
            </div>
          </div>
          <button
            onClick={() => onJump(e.relatedVersionTag)}
            className="eng-btn text-[10px] py-1 px-2 whitespace-nowrap"
          >
            跳到该版本
          </button>
        </div>

        {changed && (
          <div className="flex items-center gap-2 text-xs">
            <div
              className="eng-tag text-[11px]"
              style={{
                borderColor: STATUS_COLORS[e.oldConclusion],
                color: STATUS_COLORS[e.oldConclusion],
              }}
            >
              {STATUS_LABELS[e.oldConclusion]}
            </div>
            <ArrowRight size={14} className="text-eng-muted" />
            <div
              className="eng-tag text-[11px]"
              style={{
                borderColor: STATUS_COLORS[e.newConclusion],
                color: STATUS_COLORS[e.newConclusion],
              }}
            >
              {STATUS_LABELS[e.newConclusion]}
            </div>
          </div>
        )}

        <div className="text-xs text-eng-dim grid grid-cols-2 gap-2">
          <div className="p-2 border border-eng-border">
            <div className="text-[10px] text-eng-muted mb-1 font-mono">旧材料快照 ({e.oldMaterialsSnapshot.length} 条)</div>
            <div className="space-y-0.5">
              {e.oldMaterialsSnapshot.slice(0, 3).map((m) => (
                <div key={m.id} className="truncate text-[10px]">
                  <span className="text-eng-muted">[{SOURCE_LABELS[m.source]}]</span>{' '}
                  <span className="text-eng-dim">{m.title}</span>
                </div>
              ))}
              {e.oldMaterialsSnapshot.length > 3 && (
                <div className="text-[10px] text-eng-muted">…共 {e.oldMaterialsSnapshot.length} 条</div>
              )}
            </div>
          </div>
          <div className="p-2 border border-eng-warn/60 bg-eng-warn/5">
            <div className="text-[10px] text-eng-warn mb-1 font-mono">新备注</div>
            <div className="text-[11px] text-eng-text leading-relaxed line-clamp-3">{e.newNote}</div>
          </div>
        </div>

        <div className="text-xs p-2 border border-eng-border bg-eng-bg">
          <span className="text-eng-muted">改判原因：</span>
          <span className="text-eng-text">{e.reason}</span>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPanel() {
  const { showHistoryPanel, toggleHistoryPanel, history, filteredHistoryForZone, jumpHistoryToVersion, selectedZoneId } =
    useReviewStore();

  const list = selectedZoneId ? filteredHistoryForZone : history;

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-10 eng-panel border-t border-eng-border transition-transform duration-300 ${
        showHistoryPanel ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{
        height: selectedZoneId ? 320 : 360,
      }}
    >
      <header className="px-4 py-2 border-b border-eng-border flex items-center justify-between">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            <Clock3 size={14} className="text-eng-line" /> 历史改判追溯
          </div>
          <div className="text-[10px] text-eng-muted font-mono">
            {selectedZoneId ? (
              <>当前仅显示分区 <span className="text-eng-warn">{selectedZoneId}</span> 的 {list.length} 条记录</>
            ) : (
              <>全量 {list.length} 条改判记录 · 点选分区后可自动过滤</>
            )}
          </div>
        </div>
        <button onClick={toggleHistoryPanel} className="eng-btn py-1 px-2">
          <X size={14} />
        </button>
      </header>

      <div className="overflow-y-auto p-4" style={{ height: 'calc(100% - 49px)' }}>
        {list.length === 0 ? (
          <div className="text-xs text-eng-muted eng-panel p-4 text-center">暂无历史记录</div>
        ) : (
          list.map((e) => <EventBlock key={e.id} e={e} onJump={jumpHistoryToVersion} />)
        )}
      </div>
    </div>
  );
}
