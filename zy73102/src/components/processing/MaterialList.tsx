import { useMemo } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const typeLabel: Record<string, string> = {
  pipe: '管道',
  hopper: '雨水斗',
  gutter: '天沟',
  fitting: '管件',
  sealant: '密封',
};

const statusLabel: Record<string, { label: string; className: string }> = {
  confirmed: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: '待处理', className: 'bg-slate-100 text-slate-600' },
  conflicted: { label: '有冲突', className: 'bg-amber-100 text-amber-700' },
  obsolete: { label: '已废弃', className: 'bg-slate-200 text-slate-500' },
};

export default function MaterialList() {
  const materials = useTrackStore((s) => s.materials);
  const currentRunId = useTrackStore((s) => s.currentRunId);
  const filterState = useTrackStore((s) => s.filterState);

  const list = useMemo(() => {
    return materials
      .filter((m) => !currentRunId || m.runId === currentRunId)
      .filter((m) => filterState.materialTypes.length === 0 || filterState.materialTypes.includes(m.materialType))
      .filter((m) => filterState.processingStatuses.length === 0 || filterState.processingStatuses.includes(m.processingStatus))
      .slice(0, 20);
  }, [materials, currentRunId, filterState]);

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold text-slate-700">材料清单</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
          显示 {list.length} 条
        </span>
      </div>

      <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
        {list.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 py-8 text-center text-[11px] text-slate-400">
            当前筛选条件下无匹配材料
          </div>
        ) : (
          list.map((m) => {
            const s = statusLabel[m.processingStatus];
            return (
              <div
                key={m.materialId}
                className="group rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] transition-colors hover:border-[#1F3A5F]/30 hover:bg-[#1F3A5F]/[0.02]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800 truncate" title={m.standardName}>
                        {m.standardName}
                      </span>
                      {m.lockedFields.length > 0 && (
                        <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1 py-0.5 text-[9px] text-emerald-600 shrink-0">
                          <Lock size={8} />
                          {m.lockedFields.length}字段
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{m.materialId}</span>
                      <span>·</span>
                      <span>{m.drawingVersion}</span>
                      <span>·</span>
                      <span>{m.sourceNoteNumber}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600">
                      {typeLabel[m.materialType] ?? m.materialType}
                    </span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium', s.className)}>
                      {s.label}
                    </span>
                  </div>
                  <button className="text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#1F3A5F]">
                    定位3D →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
