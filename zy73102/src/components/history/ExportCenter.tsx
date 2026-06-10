import { useMemo, useState } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import { cn } from '@/lib/utils';
import { FileDown, FileText, RefreshCw } from 'lucide-react';
import { buildFileName, exportRunData, formatFileSize } from '@/utils/export';
import type { TrackRun } from '@/types';

export default function ExportCenter() {
  const batches = useTrackStore((s) => s.batches);
  const getRunsByBatchId = useTrackStore((s) => s.getRunsByBatchId);
  const exportRecords = useTrackStore((s) => s.exportRecords);
  const materials = useTrackStore((s) => s.materials);
  const collisions = useTrackStore((s) => s.collisions);

  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.batchId ?? '');
  const [selectedRunNumber, setSelectedRunNumber] = useState<number | ''>('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');

  const runs: TrackRun[] = useMemo(() => {
    if (!selectedBatchId) return [];
    return getRunsByBatchId(selectedBatchId);
  }, [selectedBatchId, getRunsByBatchId]);

  const selectedRun = useMemo(
    () => runs.find((r) => r.runNumber === selectedRunNumber) ?? null,
    [runs, selectedRunNumber]
  );

  const previewFileName = useMemo(() => {
    const batch = batches.find((b) => b.batchId === selectedBatchId);
    const runNum = selectedRunNumber ?? (runs.length > 0 ? runs[runs.length - 1].runNumber : 1);
    return buildFileName(batch?.batchId ?? 'BATCHxxx', Number(runNum), format);
  }, [batches, selectedBatchId, selectedRunNumber, runs, format]);

  const handleExport = () => {
    if (!selectedRun) return;
    exportRunData(selectedRun, format, materials, collisions);
  };

  const canExport = Boolean(selectedBatchId && selectedRunNumber !== '' && selectedRun);

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">导出中心</h2>
        <p className="text-[11px] text-slate-500">选择批次 + 执行轮次，导出 CSV/JSON 报告</p>
      </header>

      <div className="space-y-4 p-4">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">选择批次</label>
            <select
              value={selectedBatchId}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setSelectedRunNumber('');
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#1F3A5F] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
            >
              <option value="">-- 请选择批次 --</option>
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batchId} · {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              执行轮次 {selectedBatchId && `（该批次共 ${runs.length} 次）`}
            </label>
            <select
              value={selectedRunNumber}
              onChange={(e) =>
                setSelectedRunNumber(e.target.value === '' ? '' : Number(e.target.value))
              }
              disabled={!selectedBatchId || runs.length === 0}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#1F3A5F] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">-- 请选择轮次 --</option>
              {runs.map((r) => (
                <option key={r.runId} value={r.runNumber}>
                  Run #{r.runNumber} · {r.drawingVersion} ·{' '}
                  {new Date(r.executedAt).toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">导出格式</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all',
                  format === 'csv'
                    ? 'border-[#1F3A5F] bg-[#1F3A5F]/5 ring-2 ring-[#1F3A5F]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="export-format"
                  className="hidden"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                />
                <FileText
                  size={16}
                  className={cn(format === 'csv' ? 'text-[#1F3A5F]' : 'text-slate-400')}
                />
                <span className={cn('font-medium', format === 'csv' ? 'text-[#1F3A5F]' : 'text-slate-600')}>
                  CSV 表格
                </span>
              </label>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all',
                  format === 'json'
                    ? 'border-[#1F3A5F] bg-[#1F3A5F]/5 ring-2 ring-[#1F3A5F]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="export-format"
                  className="hidden"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                />
                <FileText
                  size={16}
                  className={cn(format === 'json' ? 'text-[#1F3A5F]' : 'text-slate-400')}
                />
                <span className={cn('font-medium', format === 'json' ? 'text-[#1F3A5F]' : 'text-slate-600')}>
                  JSON 原始
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              预览文件名
            </div>
            <div className="flex items-center gap-2 break-all text-xs font-mono text-slate-700">
              <FileDown size={14} className="shrink-0 text-[#1F3A5F]" />
              {previewFileName}
            </div>
            {selectedRun && (
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-slate-500">
                <span>📦 材料 {selectedRun.materialCount}</span>
                <span>⚠️ 碰撞 {selectedRun.collisionCount}</span>
                <span>🔴 异常 {selectedRun.abnormalCount}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={!canExport}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1F3A5F] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#182f4d] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <FileDown size={16} /> 📤 导出下载
          </button>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700">
              历史导出记录 <span className="text-slate-400 font-normal">({exportRecords.length})</span>
            </h3>
          </div>

          {exportRecords.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 py-6 text-center text-[11px] text-slate-400">
              暂无导出记录
            </div>
          ) : (
            <ul className="space-y-2 max-h-52 overflow-y-auto">
              {exportRecords.map((rec) => (
                <li
                  key={rec.exportId}
                  className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2.5 hover:bg-slate-50"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded',
                      rec.format === 'csv' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    )}
                  >
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-700" title={rec.fileName}>
                      {rec.fileName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>
                        {new Date(rec.exportAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>·</span>
                      <span>{formatFileSize(rec.fileSize)}</span>
                      <span>·</span>
                      <span className="uppercase">{rec.format}</span>
                    </div>
                  </div>
                  <button
                    className="flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 transition-colors hover:border-[#1F3A5F] hover:bg-[#1F3A5F] hover:text-white"
                    title="重新下载"
                  >
                    <RefreshCw size={12} />
                    重下
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
