import { AlertTriangle, Lightbulb, Layers, CheckSquare, Square } from 'lucide-react';
import type { LayerAbnormality } from '../types';
import { useMaterialStore } from '../store';

interface Props {
  recordId: string;
  abnormal: LayerAbnormality;
}

export function AbnormalityCard({ recordId, abnormal }: Props) {
  const markReviewed = useMaterialStore((s) => s.markAbnormalityReviewed);

  if (!abnormal.hasAbnormality) {
    return (
      <div className="card p-4 bg-confirm-50/50 border-confirm-300">
        <div className="flex items-center gap-2 text-confirm-700">
          <Layers size={18} />
          <b className="font-song">图层命名检查通过</b>
        </div>
        <p className="text-xs text-confirm-800/80 mt-1">
          该材料图层命名符合 BIM 标准，已按防火分区正确归属，明细表可自动统计。
        </p>
      </div>
    );
  }

  return (
    <div className="card p-0 border-fire-500 border-2 bg-stripe-red overflow-hidden">
      <div className="bg-fire-500 text-white px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={22} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-song font-bold tracking-wide">图层命名异常 · 未通过检查</div>
          <div className="text-xs opacity-90 mt-0.5">
            本记录不会在报表中显示为「已通过」，异常原因与建议会完整保留
          </div>
        </div>
        <button
          onClick={() => markReviewed(recordId)}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 border border-white/50 transition"
          title="我已确认此异常原因并按建议跟进整改"
        >
          {abnormal.reviewed ? (
            <>
              <CheckSquare size={14} /> 已复核
            </>
          ) : (
            <>
              <Square size={14} /> 标记已复核
            </>
          )}
        </button>
      </div>

      <div className="p-4 space-y-4 bg-white/90">
        <section>
          <h5 className="text-xs font-bold text-fire-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <AlertTriangle size={12} /> 异常原因
          </h5>
          <p className="text-sm text-ink-800 leading-relaxed border-l-4 border-fire-500 pl-3 py-1 bg-white">
            {abnormal.reason}
          </p>
        </section>

        <section>
          <h5 className="text-xs font-bold text-navy-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Lightbulb size={12} /> 建议修正方式
          </h5>
          <ol className="text-sm text-ink-800 leading-relaxed space-y-1 bg-white border-l-4 border-navy-500 pl-3 py-1 list-decimal list-inside whitespace-pre-line">
            {abnormal.suggestion.split('\n').map((l, i) => (
              <li key={i} className="marker:font-mono marker:text-navy-500">
                {l.replace(/^\d+\.\s*/, '')}
              </li>
            ))}
          </ol>
        </section>

        {abnormal.affectedLayers.length > 0 && (
          <section>
            <h5 className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-1.5">
              受影响图层（{abnormal.affectedLayers.length}）
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {abnormal.affectedLayers.map((l) => (
                <span
                  key={l}
                  className="px-2 py-0.5 text-[11px] font-mono bg-fire-50 text-fire-800 border border-fire-200"
                >
                  {l}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="text-[11px] text-ink-500 bg-ink-50 p-2 border border-ink-200">
          复核后此条异常的「未复核」标记会关闭，但原因与建议将始终保留在记录中，供月底复核查阅。
        </div>
      </div>
    </div>
  );
}
