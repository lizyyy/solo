import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrackStore } from '@/stores/trackStore';
import { Package, Layers, AlertTriangle, Download, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  hint,
}: {
  title: string;
  value: number;
  icon: typeof Package;
  color: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', color)}>
        <Icon size={26} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{title}</div>
        <div className="mt-0.5 text-3xl font-bold text-slate-800" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {value}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">{hint}</div>
      </div>
    </div>
  );
}

const statusLabel: Record<string, { text: string; className: string; dot: string }> = {
  pending: { text: '待处理', className: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  running: { text: '进行中', className: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500 animate-pulse' },
  reviewed: { text: '已复核', className: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  abnormal: { text: '异常', className: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function Home() {
  const navigate = useNavigate();
  const batches = useTrackStore((s) => s.batches);
  const runs = useTrackStore((s) => s.runs);
  const materials = useTrackStore((s) => s.materials);
  const collisions = useTrackStore((s) => s.collisions);
  const currentBatchId = useTrackStore((s) => s.currentBatchId);
  const currentRunId = useTrackStore((s) => s.currentRunId);
  const loadSamplePack = useTrackStore((s) => s.loadSamplePack);

  const filterState = useTrackStore((s) => s.filterState);

  const summary = useMemo(() => {
    const collisionMaterialIds = new Set(
      currentRunId
        ? collisions.filter((c) => c.runId === currentRunId).flatMap((c) => c.involvedMaterialIds)
        : collisions.flatMap((c) => c.involvedMaterialIds)
    );

    let activeMaterials = currentRunId ? materials.filter((m) => m.runId === currentRunId) : materials;
    let activeCollisions = currentRunId ? collisions.filter((c) => c.runId === currentRunId) : collisions;

    if (filterState.collisionOnly) {
      activeMaterials = activeMaterials.filter((m) => collisionMaterialIds.has(m.materialId));
    }

    const abnormal = activeMaterials.filter((m) => m.processingStatus === 'conflicted' || m.processingStatus === 'pending');
    const latestRun = runs.find((r) => r.runId === currentRunId);
    return {
      materialCount: activeMaterials.length,
      collisionCount: activeCollisions.length,
      abnormalCount: abnormal.length,
      latestVersion: latestRun?.drawingVersion ?? '—',
    };
  }, [runs, materials, collisions, currentRunId, filterState.collisionOnly]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              主控制台
            </h1>
            <p className="mt-1 text-sm text-slate-500">批次管理 · 样例导入 · 页面摘要</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSamplePack}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition-colors hover:border-slate-300"
            >
              🔄 重新加载样例
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            title="材料总数"
            value={summary.materialCount}
            icon={Package}
            color="bg-blue-50 text-blue-600"
            hint="归一化后追踪项"
          />
          <SummaryCard
            title="碰撞记录"
            value={summary.collisionCount}
            icon={AlertTriangle}
            color="bg-amber-50 text-amber-600"
            hint="去重后保留条数"
          />
          <SummaryCard
            title="异常数量"
            value={summary.abnormalCount}
            icon={AlertTriangle}
            color="bg-red-50 text-red-600"
            hint="冲突/待处理状态"
          />
          <SummaryCard
            title="最新版本"
            value={0}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600"
            hint={`当前版本：${summary.latestVersion}`}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">批次管理</h2>
                <p className="text-[11px] text-slate-500">
                  共 {batches.length} 个追踪批次
                </p>
              </div>
              <button className="flex items-center gap-1 rounded-md bg-[#1F3A5F] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#182f4d]">
                + 新建批次
              </button>
            </div>

            {batches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-xs text-slate-400">
              暂无批次，请先从右侧导入样例包
              </div>
            ) : (
              <div className="grid gap-3">
                {batches.map((b) => {
                  const batchRuns = runs.filter((r) => r.batchId === b.batchId);
                  const s = statusLabel[b.status];
                  const active = b.batchId === currentBatchId;
                  return (
                    <article
                      key={b.batchId}
                      className={cn(
                        'group rounded-lg border p-4 transition-all cursor-pointer',
                        active
                          ? 'border-[#1F3A5F] bg-[#1F3A5F]/5 ring-2 ring-[#1F3A5F]/20 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      )}
                      onClick={() => navigate('/tracker')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <Layers size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-800">
                                {b.name}
                              </h3>
                              <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', s.className)}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                                {s.text}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                              <span>{b.batchId}</span>
                              <span>·</span>
                              <span>{b.samplePackName}</span>
                              <span>·</span>
                              <span>{batchRuns.length} 次执行</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {batchRuns.map((r) => (
                                <span
                                  key={r.runId}
                                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600"
                                >
                                  {r.drawingVersion}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={18} className="mt-1 shrink-0 text-slate-300 transition-colors group-hover:text-[#1F3A5F]" />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50 p-8 shadow-sm">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1F3A5F]/10 text-[#1F3A5F]">
                <Package size={32} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-slate-800">样例包导入区</h3>
              <p className="mb-5 text-center text-[11px] leading-relaxed text-slate-500">
                拖拽上传图纸包 + 会议纪要<br />
                或一键加载内置标准样例包A
              </p>
              <button
                onClick={loadSamplePack}
                className="flex items-center gap-2 rounded-lg bg-[#1F3A5F] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#182f4d] hover:shadow-lg"
              >
                🚀 一键加载样例包A
              </button>
              <p className="mt-3 text-[10px] text-slate-400">
                支持 .zip / 拖拽至此处上传
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigate('/tracker')}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#1F3A5F]/30 hover:shadow-md"
              >
                <Layers size={20} className="text-[#1F3A5F]" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">追踪工作台</div>
                  <div className="text-[10px] text-slate-400">3D 可视化</div>
                </div>
              </button>
              <button
                onClick={() => navigate('/collision')}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#1F3A5F]/30 hover:shadow-md"
              >
                <AlertTriangle size={20} className="text-amber-600" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">碰撞中心</div>
                  <div className="text-[10px] text-slate-400">异常追溯</div>
                </div>
              </button>
              <button
                onClick={() => navigate('/history')}
                className="col-span-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#1F3A5F]/30 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <Download size={20} className="text-emerald-600" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">历史与导出</div>
                    <div className="text-[10px] text-slate-400">执行对比 + 报告导出</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-slate-300" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
