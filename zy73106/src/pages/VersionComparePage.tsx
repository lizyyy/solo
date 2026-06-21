import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftRight, ChevronDown, GitCompare, Tag } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useDrawingDetail } from '@/hooks/useDrawingDetail';
import { useShallow } from 'zustand/react/shallow';
import type { DrawingMetrics, DrawingVersion, MaterialBatch, NoteBlock } from '@/types';
import { METRIC_FIELD_LABELS, NOTE_TAG_LABELS } from '@/types';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/lib/utils';

function simpleDiff(oldText: string, newText: string): { added: string[]; common: string[] } {
  const oldSents = new Set(oldText.split(/[。！？；\n]/).map(s => s.trim()).filter(Boolean));
  const newSents = newText.split(/[。！？；\n]/).map(s => s.trim()).filter(Boolean);
  const added: string[] = [];
  const common: string[] = [];
  for (const s of newSents) {
    if (!oldSents.has(s)) added.push(s); else common.push(s);
  }
  return { added, common };
}

const METRIC_KEYS: (keyof DrawingMetrics)[] = ['collisionPoints', 'unqualifiedItems', 'sunShadowRisk', 'volumeDeviation'];

interface VersionCardProps {
  version: DrawingVersion | null;
  notes: NoteBlock[];
  side: 'old' | 'new';
  metrics: DrawingMetrics | null;
  otherMetrics: DrawingMetrics | null;
  materials: MaterialBatch[];
  versionUploadedAt?: string;
  diff?: { addedCount: number; stillMissing: number };
}

function VersionCard({
  version, notes, side, metrics, otherMetrics, materials, versionUploadedAt, diff,
}: VersionCardProps) {
  return (
    <div className={cn(
      'flex flex-col rounded-sm border overflow-hidden',
      side === 'old' ? 'border-steel-500 bg-steel-700/30' : 'border-[#3498DB] bg-[#1A5276]/20',
    )}>
      <div className={cn(
        'px-4 py-3 border-b relative',
        side === 'old' ? 'bg-steel-700/40 border-steel-600' : 'bg-[#1A5276]/30 border-[#3498DB]/60',
      )}>
        {version ? (
          <>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-lg text-steel-100">{version.version}</span>
              {version.isLatest && side === 'new' && (
                <span className="stamp-badge text-[#E74C3C] border-[#E74C3C]">LATEST</span>
              )}
              {version.isLatest && side !== 'new' && <Tag className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="text-sm text-steel-300">上传人: {version.uploadedBy}</div>
            <div className="text-sm text-steel-300">{formatDateTime(version.uploadedAt)}</div>
            <div className="mt-2 text-xs bg-steel-800/70 rounded-sm p-2 border-l-4 border-steel-400">
              <div className="font-semibold text-steel-100 mb-1">更新说明:</div>
              <div className="text-steel-300">{version.changeLog}</div>
            </div>
          </>
        ) : (
          <div className="text-steel-400 italic">请选择版本</div>
        )}
      </div>

      {metrics && (
        <div className={cn(
          'px-4 py-3 border-b',
          side === 'old' ? 'bg-steel-800/50 border-steel-600' : 'bg-[#1A5276]/10 border-[#3498DB]/40',
        )}>
          <div className="text-xs font-bold text-steel-200 mb-3 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> 体量指标快照
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METRIC_KEYS.map(k => {
              const v = metrics[k];
              const otherV = otherMetrics?.[k];
              const delta = otherV != null ? v - otherV : 0;
              const isDiff = otherV != null && otherV !== v;
              const isBetter = delta < 0;
              return (
                <div
                  key={k}
                  className={cn(
                    'rounded-sm px-2.5 py-2 border',
                    isDiff
                      ? isBetter
                        ? 'bg-emerald-900/40 border-emerald-700/60'
                        : 'bg-[#E74C3C]/20 border-[#E74C3C]/40'
                      : 'bg-steel-800/60 border-steel-600',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-steel-400">{METRIC_FIELD_LABELS[k]}</span>
                    {otherV != null && isDiff && (
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-sm',
                        isBetter ? 'bg-emerald-900/60 text-emerald-400' : 'bg-[#E74C3C]/30 text-[#E74C3C]',
                      )}>
                        Δ{delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    'text-lg font-bold',
                    isDiff
                      ? isBetter ? 'text-emerald-400' : 'text-[#E74C3C]'
                      : 'text-steel-300',
                  )}>
                    {v}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {version && (
        <div className={cn(
          'px-4 py-3 border-b',
          side === 'old' ? 'bg-steel-800/30 border-steel-600' : 'bg-[#1A5276]/5 border-[#3498DB]/40',
        )}>
          <div className="text-xs font-bold text-steel-200 mb-3 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> 材料批次记录
          </div>
          {materials.length === 0 ? (
            <div className="text-xs text-steel-400 italic py-2 text-center">暂无材料批次</div>
          ) : (
            <div className="space-y-1.5">
              {materials.map(m => {
                const uploadedAt = versionUploadedAt ? new Date(versionUploadedAt).getTime() : Date.now();
                const suppliedAt = m.suppliedAt ? new Date(m.suppliedAt).getTime() : null;
                const isSuppliedBefore = suppliedAt != null && suppliedAt <= uploadedAt;
                const isMissing = m.isMissing;
                const showAsNotRecorded = side === 'old' && !isSuppliedBefore;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'text-xs px-2 py-1.5 rounded-sm border flex items-center justify-between gap-2',
                      showAsNotRecorded
                        ? 'bg-steel-800/50 border-steel-600 border-dashed text-steel-500 italic'
                        : isMissing
                          ? 'bg-[#E74C3C]/15 border-[#E74C3C]/40 text-[#E74C3C]'
                          : side === 'new'
                            ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                            : 'bg-steel-800/60 border-steel-600 text-steel-300',
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold shrink-0">{m.batchNo}</span>
                      <span className="truncate">{m.materialName}</span>
                    </div>
                    <span className="text-[10px] shrink-0">
                      {showAsNotRecorded ? '未录入/待补' : isMissing ? '缺料' : '齐备'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {side === 'new' && diff && (diff.addedCount > 0 || diff.stillMissing > 0) && (
        <div className="px-4 py-2 bg-amber-900/20 border-b border-amber-700/40">
          <div className="flex items-center gap-4 text-[11px]">
            {diff.addedCount > 0 && (
              <span className="text-emerald-400 font-bold">
                · 新增补录 {diff.addedCount} 项
              </span>
            )}
            {diff.stillMissing > 0 && (
              <span className="text-[#E74C3C] font-bold">
                · 仍缺料 {diff.stillMissing} 项
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-3 flex-1 overflow-auto max-h-[50vh]">
        {notes.length === 0 ? (
          <div className="text-sm text-steel-400 italic py-8 text-center">该版本暂无备注</div>
        ) : (
          notes.map((n: any) => (
            <div
              key={n.id}
              className={cn(
                'bg-steel-800 rounded-sm border p-3 shadow-sm',
                n._isNew ? 'border-emerald-600/60 ring-1 ring-emerald-600/30' : 'border-steel-600',
              )}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-sm',
                  n.tag === 'initial' && 'bg-steel-600 text-steel-100',
                  n.tag === 'supplement' && 'bg-amber-900/40 text-amber-400',
                  n.tag === 'review' && 'bg-purple-900/40 text-purple-400',
                  n.tag === 'fix' && 'bg-teal-900/40 text-teal-400',
                )}>
                  {NOTE_TAG_LABELS[n.tag]}
                </span>
                <span className="text-xs text-steel-300">{n.authorName}</span>
                <span className="text-xs text-steel-400 ml-auto">{formatDateTime(n.createdAt)}</span>
                {n._isNew && (
                  <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm font-bold">新</span>
                )}
              </div>
              <div className="text-sm text-steel-100 whitespace-pre-wrap">
                {n._diff && n._diff.length > 0 ? (
                  <div>
                    {n._diff.map((s: string, i: number) => (
                      <span key={i} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded-sm bg-amber-700/40 text-amber-200">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : n.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function VersionComparePage() {
  const { id } = useParams<{ id: string }>();
  useDrawingDetail(id);
  const { drawings, versions, notes, materials } = useAppStore(
    useShallow((s) => ({
      drawings: s.drawings,
      versions: s.versions,
      notes: s.notes,
      materials: s.materials,
    })),
  );
  const drawing = drawings.find(d => d.id === id);
  const dVersions = useMemo(() => versions.filter(v => v.drawingId === id).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  ), [versions, id]);
  const dMaterials = useMemo(() => materials.filter(m => m.drawingId === id), [materials, id]);

  const latest = dVersions.find(v => v.isLatest) ?? dVersions[0] ?? null;
  const prev = dVersions.find(v => !v.isLatest) ?? null;

  const [oldVid, setOldVid] = useState<string | null>(prev?.id ?? null);
  const [newVid, setNewVid] = useState<string | null>(latest?.id ?? null);

  const oldVer = dVersions.find(v => v.id === oldVid) ?? null;
  const newVer = dVersions.find(v => v.id === newVid) ?? null;
  const oldNotes = notes.filter(n => n.versionId === oldVid).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const newNotes = notes.filter(n => n.versionId === newVid).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const oldNotesMap = useMemo(() => {
    const m = new Map<string, NoteBlock>();
    for (const n of oldNotes) m.set(n.tag + '|' + n.authorId, n);
    return m;
  }, [oldNotes]);

  const materialDiff = useMemo(() => {
    if (!oldVer || !newVer) return { addedCount: 0, stillMissing: 0 };
    const oldUploadedAt = new Date(oldVer.uploadedAt).getTime();
    const newUploadedAt = new Date(newVer.uploadedAt).getTime();
    let addedCount = 0;
    let stillMissing = 0;
    for (const m of dMaterials) {
      const oldSupplied = m.suppliedAt && new Date(m.suppliedAt).getTime() <= oldUploadedAt;
      const newSupplied = m.suppliedAt && new Date(m.suppliedAt).getTime() <= newUploadedAt;
      if (!oldSupplied && newSupplied && !m.isMissing) addedCount++;
      if (m.isMissing) stillMissing++;
    }
    return { addedCount, stillMissing };
  }, [oldVer, newVer, dMaterials]);

  const oldMaterialsFiltered = useMemo(() => {
    if (!oldVer) return dMaterials;
    return dMaterials;
  }, [dMaterials, oldVer]);

  const volumeDiffCount = useMemo(() => {
    if (!drawing || !oldVer || !newVer) return 0;
    const m = drawing.metrics;
    let count = 0;
    const relevantChanges = [m.collisionPoints > 0 ? 1 : 0, m.unqualifiedItems > 0 ? 1 : 0];
    count = relevantChanges.filter(Boolean).length;
    return count;
  }, [drawing, oldVer, newVer]);

  const sunDiffCount = useMemo(() => {
    if (!drawing) return 0;
    return drawing.metrics.sunShadowRisk > 0 ? 1 : 0;
  }, [drawing]);

  const materialDiffCount = useMemo(() => {
    return materialDiff.addedCount + materialDiff.stillMissing;
  }, [materialDiff]);

  const noteDiffCount = useMemo(() => {
    let added = 0;
    let modified = 0;
    for (const n of newNotes) {
      const match = oldNotesMap.get(n.tag + '|' + n.authorId);
      if (!match) added++;
      else {
        const { added: diffAdded } = simpleDiff(match.content, n.content);
        if (diffAdded.length > 0) modified++;
      }
    }
    return added + modified;
  }, [newNotes, oldNotesMap]);

  if (!drawing) {
    return <div className="p-8 text-center text-steel-300">图纸不存在</div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm bg-[#1A5276]/30 border border-[#3498DB] flex items-center justify-center">
          <GitCompare className="w-5 h-5 text-[#5DADE2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-steel-100">版本差异对比 · {drawing.name}</h1>
          <p className="text-sm text-steel-300">{drawing.projectNo} · {drawing.buildingName}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-5">
          <label className="block text-xs font-semibold text-steel-300 mb-1">旧版本 (左)</label>
          <div className="relative">
            <select
              value={oldVid ?? ''}
              onChange={e => setOldVid(e.target.value || null)}
              className="w-full appearance-none bg-steel-800 border border-steel-500 rounded-sm px-4 py-2.5 pr-10 text-sm text-steel-100 focus:ring-2 focus:ring-steel-500 focus:border-steel-400 outline-none"
            >
              <option value="">-- 选择版本 --</option>
              {dVersions.map(v => (
                <option key={v.id} value={v.id}>{v.version} · {v.uploadedBy} · {formatDateTime(v.uploadedAt)}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-steel-400 pointer-events-none" />
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-center pt-6">
          <ArrowLeftRight className="w-5 h-5 text-steel-400" />
        </div>
        <div className="col-span-5">
          <label className="block text-xs font-semibold text-steel-300 mb-1">新版本 (右)</label>
          <div className="relative flex items-center gap-2">
            <div className="flex-1 relative">
              <select
                value={newVid ?? ''}
                onChange={e => setNewVid(e.target.value || null)}
                className="w-full appearance-none bg-steel-800 border border-[#3498DB] rounded-sm px-4 py-2.5 pr-10 text-sm text-steel-100 focus:ring-2 focus:ring-[#3498DB]/30 focus:border-[#5DADE2] outline-none"
              >
                <option value="">-- 选择版本 --</option>
                {dVersions.map(v => (
                  <option key={v.id} value={v.id}>{v.version}{v.isLatest ? ' (最新)' : ''} · {v.uploadedBy} · {formatDateTime(v.uploadedAt)}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-steel-400 pointer-events-none" />
            </div>
            {newVer?.isLatest && (
              <span className="stamp-badge text-[#E74C3C] border-[#E74C3C] shrink-0">LATEST</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <VersionCard
          version={oldVer}
          notes={oldNotes}
          side="old"
          metrics={drawing.metrics}
          otherMetrics={drawing.metrics}
          materials={oldMaterialsFiltered}
          versionUploadedAt={oldVer?.uploadedAt}
        />
        <div className="relative">
          <VersionCard
            version={newVer}
            notes={newNotes.map(n => {
              const match = oldNotesMap.get(n.tag + '|' + n.authorId);
              if (!match) {
                return { ...n, _isNew: true } as any;
              }
              const { added } = simpleDiff(match.content, n.content);
              return { ...n, _diff: added } as any;
            })}
            side="new"
            metrics={drawing.metrics}
            otherMetrics={drawing.metrics}
            materials={dMaterials}
            versionUploadedAt={newVer?.uploadedAt}
            diff={materialDiff}
          />
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-steel-300 px-1">差异摘要:</div>
            {newNotes.map(n => {
              const match = oldNotesMap.get(n.tag + '|' + n.authorId);
              if (!match) {
                return (
                  <div key={n.id} className="flex items-start gap-2 bg-emerald-900/20 border-l-4 border-emerald-500 rounded-sm px-3 py-2">
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm font-bold shrink-0">{newVer?.version ?? ''} 新增</span>
                    <span className="text-xs text-emerald-400">{NOTE_TAG_LABELS[n.tag]} · {n.authorName}</span>
                  </div>
                );
              }
              const { added } = simpleDiff(match.content, n.content);
              if (added.length === 0) return null;
              return (
                <div key={n.id} className="bg-[#1A5276]/20 border-l-4 border-[#3498DB] rounded-sm px-3 py-2">
                  <div className="text-[10px] text-[#5DADE2] font-bold mb-1">{NOTE_TAG_LABELS[n.tag]} · {n.authorName} 变更:</div>
                  {added.map((s, i) => (
                    <div key={i} className="text-xs text-steel-100 bg-amber-700/40 rounded-sm px-1.5 py-0.5 inline-block mr-1 mb-1">
                      {s}
                    </div>
                  ))}
                </div>
              );
            })}
            {newNotes.every(n => {
              const match = oldNotesMap.get(n.tag + '|' + n.authorId);
              if (!match) return false;
              return simpleDiff(match.content, n.content).added.length === 0;
            }) && newNotes.length > 0 && (
              <div className="text-xs text-steel-300 italic px-3 py-2">备注内容无实质性差异</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className={cn(
          'rounded-sm border p-4',
          volumeDiffCount > 0
            ? 'bg-[#E74C3C]/15 border-[#E74C3C]/40'
            : 'bg-steel-800/60 border-steel-600',
        )}>
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-wider mb-2',
            volumeDiffCount > 0 ? 'text-[#E74C3C]' : 'text-steel-400',
          )}>体量差异</div>
          <div className={cn(
            'text-3xl font-bold mb-1',
            volumeDiffCount > 0 ? 'text-[#E74C3C]' : 'text-steel-300',
          )}>{volumeDiffCount}</div>
          <div className="text-[11px] text-steel-400">碰撞 + 不合格项变化</div>
        </div>

        <div className={cn(
          'rounded-sm border p-4',
          sunDiffCount > 0
            ? 'bg-amber-900/30 border-amber-700/60'
            : 'bg-steel-800/60 border-steel-600',
        )}>
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-wider mb-2',
            sunDiffCount > 0 ? 'text-amber-400' : 'text-steel-400',
          )}>遮挡/日照差异</div>
          <div className={cn(
            'text-3xl font-bold mb-1',
            sunDiffCount > 0 ? 'text-amber-400' : 'text-steel-300',
          )}>{sunDiffCount}</div>
          <div className="text-[11px] text-steel-400">日照阴影风险变化</div>
        </div>

        <div className={cn(
          'rounded-sm border p-4',
          materialDiffCount > 0
            ? materialDiff.addedCount > materialDiff.stillMissing
              ? 'bg-emerald-900/25 border-emerald-700/50'
              : 'bg-[#E74C3C]/15 border-[#E74C3C]/40'
            : 'bg-steel-800/60 border-steel-600',
        )}>
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-wider mb-2',
            materialDiffCount > 0
              ? materialDiff.addedCount > materialDiff.stillMissing
                ? 'text-emerald-400'
                : 'text-[#E74C3C]'
              : 'text-steel-400',
          )}>材料差异</div>
          <div className={cn(
            'text-3xl font-bold mb-1',
            materialDiffCount > 0
              ? materialDiff.addedCount > materialDiff.stillMissing
                ? 'text-emerald-400'
                : 'text-[#E74C3C]'
              : 'text-steel-300',
          )}>{materialDiffCount}</div>
          <div className="text-[11px] text-steel-400">
            新增补录 {materialDiff.addedCount} · 新缺料 {materialDiff.stillMissing}
          </div>
        </div>

        <div className={cn(
          'rounded-sm border p-4',
          noteDiffCount > 0
            ? 'bg-[#1A5276]/30 border-[#3498DB]/50'
            : 'bg-steel-800/60 border-steel-600',
        )}>
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-wider mb-2',
            noteDiffCount > 0 ? 'text-[#5DADE2]' : 'text-steel-400',
          )}>备注差异</div>
          <div className={cn(
            'text-3xl font-bold mb-1',
            noteDiffCount > 0 ? 'text-[#5DADE2]' : 'text-steel-300',
          )}>{noteDiffCount}</div>
          <div className="text-[11px] text-steel-400">新增备注 + 修改备注</div>
        </div>
      </div>
    </div>
  );
}
