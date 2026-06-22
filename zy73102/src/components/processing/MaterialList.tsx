import { useMemo, useRef, useEffect } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import { useSceneStore } from '@/store/useSceneStore';
import { Lock, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaterialItem } from '@/types';

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
  const collisions = useTrackStore((s) => s.collisions);
  const currentRunId = useTrackStore((s) => s.currentRunId);
  const filterState = useTrackStore((s) => s.filterState);
  const selectedMaterialId = useSceneStore((s) => s.selectedMaterialId);
  const setSelectedMaterial = useSceneStore((s) => s.setSelectedMaterial);
  const focusOnMaterial = useSceneStore((s) => s.focusOnMaterial);

  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const collisionMaterialIds = useMemo(() => {
    return new Set(
      currentRunId
        ? collisions.filter((c) => c.runId === currentRunId).flatMap((c) => c.involvedMaterialIds)
        : collisions.flatMap((c) => c.involvedMaterialIds)
    );
  }, [collisions, currentRunId]);

  const list = useMemo(() => {
    return materials
      .filter((m) => !currentRunId || m.runId === currentRunId)
      .filter((m) => filterState.materialTypes.length === 0 || filterState.materialTypes.includes(m.materialType))
      .filter((m) => filterState.processingStatuses.length === 0 || filterState.processingStatuses.includes(m.processingStatus))
      .filter((m) => filterState.drawingVersions.length === 0 || filterState.drawingVersions.includes(m.drawingVersion))
      .filter((m) => !filterState.collisionOnly || collisionMaterialIds.has(m.materialId));
  }, [materials, currentRunId, filterState, collisionMaterialIds]);

  useEffect(() => {
    if (selectedMaterialId && selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedMaterialId]);

  const getCollisionRisk = (materialId: string): 'none' | 'low' | 'medium' | 'high' => {
    const relatedCollisions = collisions.filter((c) => c.involvedMaterialIds.includes(materialId));
    if (relatedCollisions.length === 0) return 'none';
    if (relatedCollisions.some((c) => c.confidence === 'high')) return 'high';
    if (relatedCollisions.some((c) => c.confidence === 'medium')) return 'medium';
    return 'low';
  };

  const riskLabel: Record<string, { label: string; className: string }> = {
    high: { label: '高风险碰撞', className: 'bg-red-100 text-red-700' },
    medium: { label: '中风险碰撞', className: 'bg-orange-100 text-orange-700' },
    low: { label: '低风险碰撞', className: 'bg-yellow-100 text-yellow-700' },
    none: { label: '无碰撞', className: 'bg-slate-100 text-slate-500' },
  };

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-700">材料清单</span>
          {filterState.collisionOnly && (
            <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
              <AlertTriangle size={8} />
              仅碰撞
            </span>
          )}
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
          显示 {list.length} 条
        </span>
      </div>

      <div ref={listRef} className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
        {list.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 py-8 text-center text-[11px] text-slate-400">
            当前筛选条件下无匹配材料
          </div>
        ) : (
          list.map((m: MaterialItem) => {
            const s = statusLabel[m.processingStatus];
            const isSelected = selectedMaterialId === m.materialId;
            const riskLevel = getCollisionRisk(m.materialId);
            const risk = riskLabel[riskLevel];
            const isCollision = collisionMaterialIds.has(m.materialId);

            return (
              <div
                key={m.materialId}
                ref={isSelected ? selectedItemRef : undefined}
                onClick={() => setSelectedMaterial(m.materialId, m.standardName)}
                className={cn(
                  'group rounded-md border bg-white px-2.5 py-2 text-[11px] transition-all cursor-pointer',
                  isSelected
                    ? 'border-[#1F3A5F] bg-[#1F3A5F]/5 ring-2 ring-[#1F3A5F]/20 shadow-md'
                    : 'border-slate-200 hover:border-[#1F3A5F]/30 hover:bg-[#1F3A5F]/[0.02]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn('font-semibold truncate', isSelected ? 'text-[#1F3A5F]' : 'text-slate-800')}
                        title={m.standardName}
                      >
                        {m.standardName}
                      </span>
                      {m.lockedFields.length > 0 && (
                        <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1 py-0.5 text-[9px] text-emerald-600 shrink-0">
                          <Lock size={8} />
                          {m.lockedFields.length}字段
                        </span>
                      )}
                      {isCollision && (
                        <span className={cn('flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] shrink-0', risk.className)}>
                          <AlertTriangle size={8} />
                          {risk.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{m.materialId}</span>
                      <span>·</span>
                      <span>{m.drawingVersion}</span>
                      <span>·</span>
                      <span>来源：{m.sourceNoteNumber}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600">
                      {typeLabel[m.materialType] ?? m.materialType}
                    </span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium', s.className)}>
                      {s.label}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      focusOnMaterial(m.materialId, m.standardName);
                    }}
                    className="flex items-center gap-0.5 text-[10px] text-slate-400 transition-opacity hover:text-[#1F3A5F]"
                  >
                    <MapPin size={10} />
                    定位3D
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
