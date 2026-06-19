import { ArrowRight, Clock, User, X } from 'lucide-react';
import { useSampleStore } from '../store/useSampleStore';
import { statusColorMap, verdictColorMap } from '../utils/format';

function DiffTag({
  label,
  value,
  map,
}: {
  label: string;
  value: string;
  map: Record<string, { bg: string; text: string; border: string }>;
}) {
  const c = map[value] || { bg: 'bg-ink-100', text: 'text-ink-700', border: 'border-ink-200' };
  return (
    <span className={`chip ${c.bg} ${c.text} ${c.border}`}>
      <span className="uppercase text-[9px] font-semibold opacity-70 mr-1">{label}</span>
      {value || '—'}
    </span>
  );
}

export default function HistoryPanel() {
  const open = useSampleStore((s) => s.ui.isHistoryOpen);
  const close = useSampleStore((s) => s.closeHistory);
  const selectedId = useSampleStore((s) => s.ui.selectedSampleId);
  const samples = useSampleStore((s) => s.samples);

  const records = selectedId
    ? samples.find((s) => s.id === selectedId)?.history ?? []
    : samples.flatMap((s) =>
        s.history.map((h) => ({ ...h, studentName: s.studentName, problem: s.problemTitle })),
      );

  const title = selectedId
    ? samples.find((s) => s.id === selectedId)?.studentName + ' 的变更记录'
    : '全部历史变更记录（人工确认前后）';

  return (
    <>
      <div
        className={`fixed inset-0 bg-ink-950/30 backdrop-blur-sm z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />
      <div
        className={`fixed inset-x-0 bottom-0 sm:inset-x-6 sm:bottom-6 lg:inset-x-16 z-50 bg-white rounded-t-2xl sm:rounded-2xl shadow-pop border border-ink-200 max-h-[85vh] flex flex-col transition-all duration-300 ${
          open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <header className="flex items-start justify-between gap-4 p-5 border-b border-ink-200">
          <div>
            <h2 className="font-display text-xl text-ink-950">{title}</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              用于第二天复盘前向项目经理/教研组长解释：哪些样本经过了人工确认、状态如何变化。
            </p>
          </div>
          <button onClick={close} className="btn-ghost !p-2" aria-label="关闭">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {records.length === 0 ? (
            <div className="text-center text-ink-500 py-16">暂无变更记录</div>
          ) : (
            <ol className="relative border-l-2 border-ink-200 ml-3 space-y-6">
              {records
                .slice()
                .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1))
                .map((h: any, i) => (
                  <li key={h.id + i} className="relative pl-6 animate-fadeUp" style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-ink-400 ring-4 ring-white shadow-card flex items-center justify-center" />
                    <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 hover:shadow-card transition-shadow">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-4 text-xs text-ink-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {h.changedAt}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {h.operator}
                          </span>
                          {h.studentName && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-ink-700">
                                {h.studentName} · {h.problem}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="label">状态</span>
                        <DiffTag label="前" value={h.beforeStatus} map={statusColorMap} />
                        <ArrowRight className="w-3.5 h-3.5 text-ink-400" />
                        <DiffTag
                          label="后"
                          value={h.afterStatus}
                          map={statusColorMap}
                        />
                        <span className="mx-3 h-4 w-px bg-ink-200" />
                        <span className="label">结论</span>
                        <DiffTag
                          label="前"
                          value={h.beforeVerdict || '—'}
                          map={verdictColorMap}
                        />
                        <ArrowRight className="w-3.5 h-3.5 text-ink-400" />
                        <DiffTag
                          label="后"
                          value={h.afterVerdict || '—'}
                          map={verdictColorMap}
                        />
                      </div>
                      {h.note && (
                        <div className="mt-3 rounded-md bg-white border border-ink-200 px-3 py-2 text-sm text-ink-800 leading-relaxed">
                          <span className="label">变更说明：</span>
                          {h.note}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
