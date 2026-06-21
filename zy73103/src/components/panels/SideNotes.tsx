import { useAppStore } from '../../store/useStore';
import HudCard from '../common/HudCard';
import { BookOpen, FileWarning, ClipboardList, BadgeCheck, User, Hammer } from 'lucide-react';
import { formatDate, materialStatusLabel, validateLayerName } from '../../utils/helpers';
import { twMerge } from 'tailwind-merge';

export default function SideNotes() {
  const selected = useAppStore((s) => s.selectedSchemeId);
  const schemes = useAppStore((s) => s.schemes);
  const allNotes = useAppStore((s) => s.notes);
  const allAnomalies = useAppStore((s) => s.anomalies);
  const scheme = schemes.find((x) => x.id === selected)!;
  const notes = allNotes.filter((n) => n.schemeId === selected);
  const anomalies = allAnomalies.filter((a) => a.schemeId === selected);

  return (
    <HudCard
      title="侧边说明 + 场景标注（与时间线同一口径）"
      accent="green"
      icon={<BookOpen size={12} className="text-emerald-400" />}
      className="flex h-full min-h-[260px] flex-col"
    >
      <div className="flex flex-col gap-2 p-3 overflow-y-auto custom-scrollbar max-h-[300px]">
        <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-emerald-400/90">
            <BadgeCheck size={11} />
            场景标注（3D 顶部 HUD 同文案）
          </div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-slate-200">
            {scheme.sceneAnnotation}
          </div>
        </div>

        <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-blue-400/90">
            <ClipboardList size={11} />
            责任口径 · 施工口径
          </div>
          <div className="flex items-start gap-2 text-[11.5px] text-slate-300">
            <User size={11} className="mt-0.5 shrink-0 text-blue-400/80" />
            <div>
              <span className="text-slate-500">责任：</span>
              {scheme.responsible}
            </div>
          </div>
          <div className="flex items-start gap-2 text-[11.5px] text-slate-300">
            <Hammer size={11} className="mt-0.5 shrink-0 text-amber-400/80" />
            <div>
              <span className="text-slate-500">施工：</span>
              {scheme.constructionSpec}
            </div>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-sky-400/90">
                <FileWarning size={11} />
                BIM 模型备注（{notes.length} 条）
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                CANONICAL · SYNCED
              </span>
            </div>
            {notes.map((n) => {
              const layerOk = validateLayerName(n.layerName);
              return (
                <div
                  key={n.id}
                  className={twMerge(
                    'rounded border p-2 text-[11.5px]',
                    !layerOk || n.materialStatus === 'late'
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-slate-700/60 bg-slate-800/30',
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={twMerge(
                        'rounded px-1.5 py-0.5 font-mono text-[10px]',
                        layerOk
                          ? 'bg-slate-700/70 text-slate-200 border border-slate-600/60'
                          : 'bg-red-500/15 text-red-300 border border-red-500/40 line-through decoration-red-400/70',
                      )}
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      title={!layerOk ? n.layerIssue : '图层命名合规'}
                    >
                      {n.layerName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {n.author} @ {formatDate(n.createdAt)}
                    </span>
                    <span
                      className={twMerge(
                        'ml-auto rounded px-1.5 py-0.5 text-[10px]',
                        n.materialStatus === 'complete'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : n.materialStatus === 'late'
                            ? 'bg-orange-500/20 text-orange-200 border border-orange-500/50'
                            : 'bg-blue-500/15 text-blue-300 border border-blue-500/40',
                      )}
                    >
                      {materialStatusLabel(n.materialStatus)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-300 leading-relaxed">
                    {n.content}
                  </div>
                  {!layerOk && n.layerIssue && (
                    <div className="mt-1 rounded bg-red-500/10 border border-red-500/25 px-1.5 py-1 text-[10.5px] text-red-300">
                      ⚠ 图层命名异常：{n.layerIssue}（已拎入异常区）
                    </div>
                  )}
                  {n.materialStatus === 'late' && (
                    <div className="mt-1 rounded bg-orange-500/10 border border-orange-500/30 px-1.5 py-1 text-[10.5px] text-orange-300">
                      📎 附件「{n.attachmentName ?? '送审材料'}」晚到，预计 {n.estimatedArrival ?? '待定'} 到齐，已延迟归档不阻塞流程
                    </div>
                  )}
                </div>
              );
            })}
            {anomalies.some((a) => a.status !== 'resolved') && (
              <div className="text-[10.5px] text-amber-300/90 flex items-center gap-1 pt-1">
                <FileWarning size={11} />
                未处理异常 {anomalies.filter((a) => a.status !== 'resolved').length} 条，
                <span className="underline decoration-dotted underline-offset-2 cursor-pointer hover:text-amber-200">
                  前往异常区查看 →
                </span>
              </div>
            )}
          </div>
        )}

        {notes.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-700/60 bg-slate-900/30 p-3 text-center text-[12px] text-slate-500">
            尚未导入 BIM 备注样例 · 点击顶栏「导入 BIM 备注样例」试跑
          </div>
        )}
      </div>
    </HudCard>
  );
}
