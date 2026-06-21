import { useMemo } from 'react';
import { Download, Table2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';
import { CSV_HEADERS } from '@/engine/types';
import { cn } from '@/lib/utils';

const COMPACT_COLS = [
  'station_name', 'latitude', 'longitude', 'tide_meters', 'tide_level', 'issues',
] as const;

export function CsvPanel() {
  const batch = useTidalStore((s) => s.batch);
  const csvPreview = useTidalStore((s) => s.csvPreview);
  const consistency = useTidalStore((s) => s.consistency);
  const selectedId = useTidalStore((s) => s.selectedAnnotationId);
  const selectStation = useTidalStore((s) => s.selectStation);
  const exportCsv = useTidalStore((s) => s.exportCsv);

  const previewRows = useMemo(() => csvPreview.split('\n'), [csvPreview]);

  if (!batch) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-glow-teal/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-glow-cyan" />
          <h3 className="font-display text-sm font-bold text-signal-moon">CSV 明细预览</h3>
          <span className="font-mono text-[10px] text-signal-moon/40">{batch.annotations.length} 行</span>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-md border border-glow-cyan/40 bg-glow-cyan/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-glow-cyan hover:bg-glow-cyan/20"
        >
          <Download className="h-3.5 w-3.5" /> 导出 CSV
        </button>
      </div>

      {/* Consistency banner */}
      <div className={cn(
        'flex items-start gap-2 px-4 py-2 text-[10px]',
        consistency?.consistent ? 'bg-glow-cyan/5 text-glow-cyan' : 'bg-signal-coral/5 text-signal-coral',
      )}>
        {consistency?.consistent ? <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <div className="font-mono leading-relaxed">
          {consistency?.consistent ? (
            <>一致性校验通过：标注 {consistency.countCheck.annotations} · 场景行 {consistency.countCheck.sceneLines} · CSV 行 {consistency.countCheck.csvRows} 三源一致，异常记录未被伪装为有效坐标</>
          ) : (
            <>
              <p className="font-semibold">一致性校验未通过：</p>
              <ul className="list-disc pl-4">
                {consistency?.mismatches.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[10px]">
          <thead className="sticky top-0 z-10 bg-abyss-800/95 backdrop-blur">
            <tr>
              <th className="border-b border-glow-teal/20 px-2 py-1.5 text-left font-semibold text-signal-moon/40">#</th>
              {COMPACT_COLS.map((h) => (
                <th key={h} className="border-b border-glow-teal/20 px-2 py-1.5 text-left font-semibold text-signal-moon/50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batch.annotations.map((ann, i) => {
              const isExc = ann.status === 'exception';
              const isPending = ann.status === 'pending_review';
              const isSel = ann.annotationId === selectedId;
              return (
                <tr
                  key={ann.annotationId}
                  onClick={() => selectStation(ann.annotationId)}
                  className={cn(
                    'cursor-pointer border-b border-glow-teal/5 transition-colors',
                    isSel ? 'bg-glow-cyan/15' : isExc ? 'bg-signal-coral/5 hover:bg-signal-coral/10' : isPending ? 'bg-signal-amber/5 hover:bg-signal-amber/10' : 'hover:bg-glow-deep/15',
                  )}
                >
                  <td className="px-2 py-1.5 text-signal-moon/30">{i + 1}</td>
                  {COMPACT_COLS.map((h) => {
                    const val = ann.csvRow[h];
                    const danger = (h === 'latitude' || h === 'longitude' || h === 'tide_meters') && val === 'PARSE_FAILED';
                    return (
                      <td
                        key={h}
                        className={cn(
                          'max-w-[140px] truncate px-2 py-1.5',
                          danger ? 'text-signal-coral font-semibold' : 'text-signal-moon/80',
                        )}
                        title={val}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-glow-teal/20 px-4 py-2 font-mono text-[9px] text-signal-moon/35">
        完整字段 {CSV_HEADERS.length} 列 · 导出后含 raw_text / source_ref / 备注 / 失败原因 全量明细
      </div>
    </div>
  );
}
