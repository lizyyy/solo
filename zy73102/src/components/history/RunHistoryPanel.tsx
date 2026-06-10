import { useMemo, useState } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import type { TrackRun } from '@/types';
import { cn } from '@/lib/utils';
import { RefreshCw, ChevronLeft, AlertCircle, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';

const statusConfig = {
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
};

type DiffType = 'same' | 'diff' | 'new';

interface DiffRow {
  field: string;
  leftValue: string;
  rightValue: string;
  diffType: DiffType;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function computeDiff(left: TrackRun, right: TrackRun): DiffRow[] {
  const fields: { key: keyof TrackRun; label: string }[] = [
    { key: 'drawingVersion', label: '图纸版本' },
    { key: 'remark', label: '备注说明' },
    { key: 'materialCount', label: '材料数量' },
    { key: 'collisionCount', label: '碰撞数量' },
    { key: 'abnormalCount', label: '异常数量' },
    { key: 'resultStatus', label: '结果状态' },
  ];

  return fields.map(({ key, label }) => {
    const lv = String(left[key] ?? '');
    const rv = String(right[key] ?? '');
    let diffType: DiffType = 'same';
    if (key === 'remark') {
      if (lv === '' && rv !== '') diffType = 'new';
      else if (lv !== rv) diffType = 'diff';
    } else {
      if (lv !== rv) diffType = 'diff';
    }
    return { field: label, leftValue: lv, rightValue: rv, diffType };
  });
}

function RunCard({
  run,
  selected,
  onClick,
  onRerun,
}: {
  run: TrackRun;
  selected: boolean;
  onClick: () => void;
  onRerun: () => void;
}) {
  const cfg = statusConfig[run.resultStatus];
  const StatusIcon = cfg.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg border p-3 transition-all',
        selected
          ? 'border-[#1F3A5F] bg-[#1F3A5F]/5 ring-2 ring-[#1F3A5F]/20 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md px-1.5 text-xs font-bold',
              cfg.bg,
              cfg.color
            )}
          >
            #{run.runNumber}
          </span>
          <StatusIcon className={cn('shrink-0', cfg.color)} size={16} />
          <div>
            <div className="text-xs font-medium text-slate-700">{run.drawingVersion}</div>
            <div className="text-[11px] text-slate-400">{formatTime(run.executedAt)}</div>
          </div>
        </div>
      </div>

      {run.remark && (
        <div className="mb-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600 line-clamp-2">
          📝 {run.remark}
        </div>
      )}

      <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[11px]">
        <div className="rounded bg-blue-50 py-1">
          <div className="text-blue-700 font-semibold">{run.materialCount}</div>
          <div className="text-blue-500 text-[10px]">材料</div>
        </div>
        <div className="rounded bg-amber-50 py-1">
          <div className="text-amber-700 font-semibold">{run.collisionCount}</div>
          <div className="text-amber-500 text-[10px]">碰撞</div>
        </div>
        <div className="rounded bg-red-50 py-1">
          <div className="text-red-700 font-semibold">{run.abnormalCount}</div>
          <div className="text-red-500 text-[10px]">异常</div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRerun();
        }}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600 transition-colors hover:border-[#1F3A5F] hover:bg-[#1F3A5F] hover:text-white"
      >
        <RefreshCw size={12} /> 补备注重跑
      </button>
    </div>
  );
}

function ComparePanel({
  left,
  right,
  onClose,
}: {
  left: TrackRun;
  right: TrackRun;
  onClose: () => void;
}) {
  const diffs = useMemo(() => computeDiff(left, right), [left, right]);

  const rowStyle = (t: DiffType) =>
    cn('transition-colors', t === 'same' && 'bg-slate-50 text-slate-500', t === 'diff' && 'bg-amber-50', t === 'new' && 'bg-emerald-50');

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-slate-700">对比视图 · Run #{left.runNumber} ↔ Run #{right.runNumber}</h4>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#1F3A5F]"
        >
          <ChevronLeft size={14} /> 收起对比
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-200">
        <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          Run #{left.runNumber} · {left.drawingVersion}
        </div>
        <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          Run #{right.runNumber} · {right.drawingVersion}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {diffs.map((d) => (
          <div key={d.field} className={cn('grid grid-cols-[auto_1fr_1fr] items-center gap-2 px-3 py-2 text-xs', rowStyle(d.diffType))}>
            <div className="font-medium text-slate-600 w-20 shrink-0">{d.field}</div>
            <div className={cn('pr-3', d.diffType === 'diff' && 'text-red-600 font-medium line-through decoration-red-400')}>
              {d.leftValue || <span className="text-slate-300">—</span>}
            </div>
            <div
              className={cn(
                'pl-3 border-l border-slate-200',
                d.diffType === 'diff' && 'text-amber-700 font-semibold',
                d.diffType === 'new' && 'text-emerald-700 font-semibold'
              )}
            >
              {d.diffType === 'new' ? <span className="mr-1 text-[10px] bg-emerald-200 px-1 rounded">新增</span> : null}
              {d.rightValue || <span className="text-slate-300">—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-200"></span>相同项</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-300"></span>差异项</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-300"></span>新增备注</span>
      </div>
    </div>
  );
}

function RerunModal({
  run,
  onClose,
  onConfirm,
}: {
  run: TrackRun;
  onClose: () => void;
  onConfirm: (remark: string) => void;
}) {
  const [remark, setRemark] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-800">补备注重跑</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            基于 Run #{run.runNumber}（{run.drawingVersion}）创建新执行
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              补充备注（必填）
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={4}
              placeholder="请说明本次重跑的原因或修正内容……"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1F3A5F] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
            />
          </div>
          <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <Lock size={12} className="mb-1 inline mr-1" />
            新 run 编号：<strong>#{run.runNumber + 1}</strong>，来源与处理状态字段将被锁定保留
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() => remark.trim() && onConfirm(remark.trim())}
            disabled={!remark.trim()}
            className="rounded-md bg-[#1F3A5F] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#182f4d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            确认重跑并生成对比
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RunHistoryPanel() {
  const batches = useTrackStore((s) => s.batches);
  const getRunsByBatchId = useTrackStore((s) => s.getRunsByBatchId);
  const addRun = useTrackStore((s) => s.addRun);
  const getMaxRunNumber = useTrackStore((s) => s.getMaxRunNumber);

  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [rerunTarget, setRerunTarget] = useState<TrackRun | null>(null);

  const toggleSelect = (runId: string) => {
    setSelectedRunIds((prev) => {
      if (prev.includes(runId)) return prev.filter((id) => id !== runId);
      if (prev.length >= 2) return [prev[1], runId];
      return [...prev, runId];
    });
  };

  const selectedRuns = selectedRunIds
    .map((id) => batches.flatMap((b) => getRunsByBatchId(b.batchId)).find((r) => r.runId === id))
    .filter(Boolean) as TrackRun[];

  const handleRerunConfirm = (remark: string) => {
    if (!rerunTarget) return;
    const maxNum = getMaxRunNumber(rerunTarget.batchId);
    const newRun: TrackRun = {
      runId: `RUN-${Date.now()}`,
      batchId: rerunTarget.batchId,
      runNumber: maxNum + 1,
      remark,
      executedAt: new Date().toISOString(),
      resultStatus: 'success',
      drawingVersion: rerunTarget.drawingVersion.replace(/V(\d+)\.(\d+)/, (_m, a, b) => `V${a}.${Number(b) + 1}`),
      materialCount: rerunTarget.materialCount + Math.floor(Math.random() * 5),
      collisionCount: Math.max(0, rerunTarget.collisionCount + Math.floor(Math.random() * 5) - 2),
      abnormalCount: Math.max(0, rerunTarget.abnormalCount + Math.floor(Math.random() * 3) - 1),
    };
    addRun(newRun);
    setSelectedRunIds([rerunTarget.runId, newRun.runId]);
    setRerunTarget(null);
  };

  const clearCompare = () => setSelectedRunIds([]);

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">执行历史对比</h2>
          <p className="text-[11px] text-slate-500">
            选择 2 个 run 查看差异 · 已选 {selectedRunIds.length}/2
          </p>
        </div>
        {selectedRunIds.length === 2 && (
          <button
            onClick={clearCompare}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
          >
            清除选择
          </button>
        )}
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {batches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-xs text-slate-400">
            暂无批次，请先在首页导入样例包
          </div>
        ) : (
          batches.map((batch) => {
            const runs = getRunsByBatchId(batch.batchId);
            return (
              <div key={batch.batchId}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-6 w-1 rounded-full bg-[#1F3A5F]"></span>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-slate-700">{batch.name}</h3>
                    <p className="text-[10px] text-slate-400">
                      {batch.batchId} · {runs.length} 次执行 · {batch.samplePackName}
                    </p>
                  </div>
                </div>

                <div className="relative pl-3">
                  <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200" />
                  <div className="space-y-3">
                    {runs.map((run, idx) => (
                      <div key={run.runId} className="relative flex items-start gap-3">
                        <div className="relative z-10 mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#1F3A5F] text-[10px] font-bold text-white shadow">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          {idx < runs.length - 1 && (
                            <div className="mb-2 flex items-center gap-1 text-[10px] text-slate-400 pl-1">
                              <span>Run{run.runNumber}</span>
                              <span className="mx-0.5">→</span>
                              <span>Run{run.runNumber + 1}</span>
                            </div>
                          )}
                          <RunCard
                            run={run}
                            selected={selectedRunIds.includes(run.runId)}
                            onClick={() => toggleSelect(run.runId)}
                            onRerun={() => setRerunTarget(run)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {selectedRuns.length === 2 && (
          <ComparePanel
            left={selectedRuns[0]}
            right={selectedRuns[1]}
            onClose={clearCompare}
          />
        )}
      </div>

      {rerunTarget && (
        <RerunModal
          run={rerunTarget}
          onClose={() => setRerunTarget(null)}
          onConfirm={handleRerunConfirm}
        />
      )}
    </section>
  );
}
