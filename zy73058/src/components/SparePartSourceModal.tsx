import { useEffect, useState } from 'react';
import { useReviewStore } from '@/store/reviewStore';
import { X, ExternalLink, Search, Package } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  highlightIds?: string[];
  onClose: () => void;
}

export function SparePartSourceModal({ highlightIds = [], onClose }: Props) {
  const { getAllSpareParts, highlightSparePartId } = useReviewStore();
  const parts = getAllSpareParts();
  const [filter, setFilter] = useState('');
  const [pulseId, setPulseId] = useState<string | null>(highlightIds[0] || null);

  useEffect(() => {
    if (!pulseId) return;
    let count = 0;
    const timer = setInterval(() => {
      count++;
      if (count >= 6) {
        clearInterval(timer);
        setPulseId(null);
      }
    }, 350);
    return () => clearInterval(timer);
  }, [pulseId]);

  useEffect(() => {
    if (highlightSparePartId) {
      setPulseId(highlightSparePartId);
    }
  }, [highlightSparePartId]);

  const filtered = parts.filter(
    (p) =>
      !filter ||
      p.id.toLowerCase().includes(filter.toLowerCase()) ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.spec.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-blue-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                备件清单 · 原始对象溯源
              </div>
              <div className="text-[11px] text-blue-200 mt-0.5">
                从复核记录跳转过来时，源行黄色闪烁 3 次。坏数据影响结论时，可顺着编号回到此处。
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="按备件编号 / 名称 / 规格搜索原始对象..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          {highlightIds.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-200 font-medium">
              🎯 关联源对象：{highlightIds.join(' / ')}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-zinc-700 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">编号</th>
                <th className="px-4 py-3 text-left font-semibold">备件名称</th>
                <th className="px-4 py-3 text-left font-semibold">规格型号</th>
                <th className="px-4 py-3 text-left font-semibold">原始来源</th>
                <th className="px-4 py-3 text-left font-semibold">批次号</th>
                <th className="px-4 py-3 text-right font-semibold">数量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[12px]">
              {filtered.map((p) => {
                const isPulse = pulseId === p.id;
                const isHighlight = highlightIds.includes(p.id);
                const isDirty = !p.spec || !p.batch;
                return (
                  <tr
                    key={p.id}
                    className={clsx(
                      'transition-colors',
                      isPulse && 'bg-yellow-300',
                      !isPulse && isHighlight && 'bg-yellow-100',
                      !isPulse && !isHighlight && 'hover:bg-blue-50/50'
                    )}
                  >
                    <td className="px-4 py-3 text-blue-700 font-bold">{p.id}</td>
                    <td className="px-4 py-3 text-zinc-800">{p.name}</td>
                    <td className="px-4 py-3">
                      {p.spec ? (
                        <span className="text-zinc-700">{p.spec}</span>
                      ) : (
                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 font-bold">
                          ⚠️ 空字段（脏数据）
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-[11px]">{p.origin}</td>
                    <td className="px-4 py-3">
                      {p.batch ? (
                        <span className="text-zinc-600">{p.batch}</span>
                      ) : (
                        <span className="text-red-600 text-[11px] font-bold">⚠️ 空</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-800">{p.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>💡 提示：可对照复核记录中"原始快照"的编号与此处一致，确认未被替换</span>
          <span className="inline-flex items-center gap-1 text-zinc-600 font-medium">
            <ExternalLink className="w-3 h-3" />
            SOURCE_OF_TRUTH
          </span>
        </div>
      </div>
    </div>
  );
}
