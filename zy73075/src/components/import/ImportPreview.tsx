import { useMemo } from 'react';
import { FileJson, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import type { FullDataset, Workorder, SparePart, ExceptionCheckResult } from '@/types';
import { useWorkorderStore } from '@/store/workorderStore';
import { runAllChecks, summarizeExceptions } from '@/utils/detector';
import { cn } from '@/lib/utils';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';

interface ImportPreviewProps {
  dataset: FullDataset;
}

interface PreviewRow {
  workorder: Workorder;
  parts: SparePart[];
  isDuplicate: boolean;
  existingNote: string | null;
  noteDiffers: boolean;
  partExceptions: { part: SparePart; result: ExceptionCheckResult }[];
}

export default function ImportPreview({ dataset }: ImportPreviewProps) {
  const existingWorkorders = useWorkorderStore(s => s.workorders);

  const rows = useMemo<PreviewRow[]>(() => {
    const existingMap = new Map(existingWorkorders.map(w => [w.id, w]));
    return dataset.workorders.map(wo => {
      const existing = existingMap.get(wo.id);
      const parts = dataset.spare_parts.filter(p => p.workorder_id === wo.id);
      const partExceptions = parts.map(p => ({ part: p, result: runAllChecks(p) }));
      const existingNote = existing?.handover_note ?? null;
      const noteDiffers =
        existingNote !== null &&
        existingNote !== '' &&
        existingNote !== wo.handover_note;
      return {
        workorder: wo,
        parts,
        isDuplicate: !!existing,
        existingNote,
        noteDiffers,
        partExceptions,
      };
    });
  }, [dataset, existingWorkorders]);

  const stats = useMemo(() => {
    const total = rows.length;
    const duplicates = rows.filter(r => r.isDuplicate).length;
    const notePreserved = rows.filter(r => r.noteDiffers).length;
    const totalParts = rows.reduce((sum, r) => sum + r.parts.length, 0);
    const partsWithException = rows.reduce(
      (sum, r) => sum + r.partExceptions.filter(pe => summarizeExceptions(pe.result).length > 0).length,
      0,
    );
    return { total, duplicates, notePreserved, totalParts, partsWithException };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="badge bg-slate-800 border-slate-600 text-slate-300">
          <FileJson className="w-3.5 h-3.5" />
          工单 <span className="font-semibold text-white">{stats.total}</span> 条
        </div>
        <div className="badge bg-amber-500/15 border-amber-500/40 text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          重复 <span className="font-semibold">{stats.duplicates}</span> 条
        </div>
        {stats.notePreserved > 0 && (
          <div className="badge bg-rose-500/15 border-rose-500/40 text-rose-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            备注保留 <span className="font-semibold">{stats.notePreserved}</span> 条
          </div>
        )}
        <div className="badge bg-violet-500/15 border-violet-500/40 text-violet-300">
          备件 <span className="font-semibold">{stats.totalParts}</span> 项，异常{' '}
          <span className="font-semibold">{stats.partsWithException}</span> 项
        </div>
      </div>

      <div className="space-y-4">
        {rows.map(row => (
          <div
            key={row.workorder.id}
            className={cn(
              'card relative overflow-hidden',
              row.isDuplicate && 'duplicate-stripe border-amber-500/40',
            )}
          >
            {row.isDuplicate && (
              <div className="absolute top-0 right-0 px-3 py-1 text-xs font-medium bg-amber-500/90 text-white rounded-bl-md">
                已存在
              </div>
            )}

            <div className="p-4 border-b border-slate-700/50">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm font-semibold text-shield-300">
                  {row.workorder.id}
                </span>
                <span className="text-sm text-slate-300">{row.workorder.device_no}</span>
                <span className="badge bg-slate-800 border-slate-600 text-slate-300">
                  {row.workorder.work_type}
                </span>
                <span className="text-sm text-slate-400">{row.workorder.location}</span>
                <span className="text-sm text-slate-500">{row.workorder.work_date}</span>
              </div>

              {row.workorder.handover_note && (
                <div className="mt-3 space-y-1">
                  {row.noteDiffers ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 text-rose-400 shrink-0" />
                        <div>
                          <p className="text-xs text-rose-400 font-medium">
                            原人工备注（将被保留不覆盖）：
                          </p>
                          <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1 mt-0.5">
                            {row.existingNote}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pl-6">
                        <div>
                          <p className="text-xs text-slate-500">导入的新备注：</p>
                          <p className="text-sm text-slate-400">{row.workorder.handover_note}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">
                      <span className="text-slate-500">备注：</span>
                      {row.workorder.handover_note}
                    </div>
                  )}
                </div>
              )}
            </div>

            {row.parts.length > 0 && (
              <div className="divide-y divide-slate-800">
                {row.partExceptions.map(({ part, result }) => {
                  const issues = summarizeExceptions(result);
                  return (
                    <div
                      key={part.id}
                      className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {result.formula && (
                          <span
                            className={cn('badge text-[11px]', CATEGORY_COLOR['公式问题'])}
                            title={result.formula}
                          >
                            {CATEGORY_EMOJI['公式问题']} 公式
                          </span>
                        )}
                        {result.unit && (
                          <span
                            className={cn('badge text-[11px]', CATEGORY_COLOR['单位问题'])}
                            title={result.unit}
                          >
                            {CATEGORY_EMOJI['单位问题']} 单位
                          </span>
                        )}
                        {result.threshold && (
                          <span
                            className={cn('badge text-[11px]', CATEGORY_COLOR['阈值问题'])}
                            title={result.threshold}
                          >
                            {CATEGORY_EMOJI['阈值问题']} 阈值
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-200">{part.part_name}</span>
                      <span className="text-slate-500 font-mono text-xs">{part.part_code}</span>
                      <span className="text-slate-400">
                        申报 <span className="text-slate-200">{part.req_qty}</span>
                        {' / '}
                        出库 <span className="text-slate-200">{part.act_qty}</span>
                        {' '}
                        <span className="text-slate-500">{part.unit}</span>
                      </span>
                      {issues.length > 0 && (
                        <span className="text-xs text-slate-500 truncate max-w-md">
                          {issues[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
