import type { Material, FittingResult } from '../types';

interface Props {
  material: Material;
  fittingResult: FittingResult | undefined;
  onClose: () => void;
}

export default function DraftTraceModal({ material, fittingResult, onClose }: Props) {
  const sortedLabels = [...material.dataPoints].sort((a, b) => a.x - b.x).map(dp => dp.label);
  const originalLabels = material.dataPoints.map(dp => dp.label);
  const orderChanged = sortedLabels.join(',') !== originalLabels.join(',');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>📜</span>
              排序溯源 · 学生草稿原始说法
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              材料：<strong className="text-slate-700">{material.currentName}</strong> · {material.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-black/10 flex items-center justify-center text-slate-500 text-xl transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-auto space-y-5">
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-purple-500 text-white flex items-center justify-center text-[10px]">1</span>
              学生草稿原文
            </h3>
            <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-sm text-slate-800 leading-relaxed whitespace-pre-wrap shadow-inner">
              {material.draftOriginalText || '（未记录学生草稿原文，请联系老叶或对应学生）'}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-purple-500 text-white flex items-center justify-center text-[10px]">2</span>
              数据点顺序对比
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border-2 border-dashed border-slate-300">
                <div className="text-xs text-slate-500 mb-2 font-medium">
                  📋 草稿原始顺序
                  {orderChanged && <span className="ml-2 tag tag-red">⚠️ 与浓度序不一致</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {originalLabels.map((lb, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-mono">{i + 1}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-sm font-mono">{lb}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl border-2 border-green-400 bg-green-50/50">
                <div className="text-xs text-slate-500 mb-2 font-medium">
                  ✅ 推荐顺序（按浓度升序）
                  {!orderChanged && <span className="ml-2 tag tag-green">✓ 一致</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sortedLabels.map((lb, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded bg-green-500 text-white flex items-center justify-center text-xs font-mono">{i + 1}</span>
                      <span className="px-2 py-0.5 bg-green-100 rounded text-sm font-mono text-green-700">{lb}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-purple-500 text-white flex items-center justify-center text-[10px]">3</span>
              排序说明（系统注释）
            </h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {material.sortNote || '（系统未生成排序注释）'}
            </div>
          </section>

          {fittingResult?.unstableSort && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-purple-500 text-white flex items-center justify-center text-[10px]">4</span>
                不稳定判定
              </h3>
              <div className={`p-4 rounded-xl border-2 ${
                fittingResult.unstableSort.unstable
                  ? 'bg-red-50 border-red-300'
                  : 'bg-green-50 border-green-300'
              }`}>
                <div className="text-sm font-medium mb-1">
                  {fittingResult.unstableSort.unstable ? '⚠️ 判定：排序不稳定' : '✅ 判定：排序正常'}
                </div>
                <div className="text-xs text-slate-600">
                  建议顺序：<code className="px-1.5 py-0.5 bg-white rounded font-mono">
                    {fittingResult.unstableSort.suggestedOrder.join(' → ')}
                  </code>
                </div>
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-purple-500 text-white flex items-center justify-center text-[10px]">5</span>
              各数据点原始详情
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="th">草稿顺序</th>
                    <th className="th">标签</th>
                    <th className="th">X</th>
                    <th className="th">Y</th>
                    <th className="th">来源</th>
                    <th className="th">是否边界</th>
                    <th className="th">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {material.dataPoints.map((dp, i) => (
                    <tr key={dp.id}>
                      <td className="td text-center text-slate-400">#{i + 1}</td>
                      <td className="td font-mono">{dp.label}</td>
                      <td className="td font-mono">{dp.x}</td>
                      <td className="td font-mono">{dp.y.toFixed(4)}</td>
                      <td className="td">{dp.source === 'student' ? '学生自测' : '参考数据'}</td>
                      <td className="td">{dp.isBoundary ? '🔸 边界' : '-'}</td>
                      <td className="td text-slate-500 text-xs">{dp.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">关闭</button>
        </div>
      </div>
    </div>
  );
}
