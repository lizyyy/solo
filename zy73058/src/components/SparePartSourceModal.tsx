import { useEffect, useState } from 'react';
import { useReviewStore } from '@/store/reviewStore';
import { X, ExternalLink, Search, Package, AlertTriangle, ArrowRight, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import type { SparePartRole } from '@/types';

interface Props {
  highlightIds?: string[];
  primaryAnomalyId?: string;
  correctedIds?: string[];
  normalIds?: string[];
  roleLabels?: Record<string, string>;
  onClose: () => void;
}

const roleBadge: Record<SparePartRole | 'none', { cls: string; label: string; Icon: typeof Tag }> = {
  'primary-anomaly': {
    cls: 'bg-red-500 text-white border-red-600',
    label: '🔴 原始异常对象（溯源终点）',
    Icon: AlertTriangle,
  },
  corrected: {
    cls: 'bg-zinc-200 text-zinc-800 border-zinc-400',
    label: '⚪ 修正后对照',
    Icon: ArrowRight,
  },
  normal: {
    cls: 'bg-blue-100 text-blue-800 border-blue-300',
    label: '🔵 普通关联',
    Icon: Tag,
  },
  none: {
    cls: 'bg-zinc-100 text-zinc-600 border-zinc-300',
    label: '—',
    Icon: Tag,
  },
};

export function SparePartSourceModal({
  highlightIds = [],
  primaryAnomalyId,
  correctedIds = [],
  normalIds = [],
  roleLabels = {},
  onClose,
}: Props) {
  const { getAllSpareParts, highlightSparePartId } = useReviewStore();
  const parts = getAllSpareParts();
  const [filter, setFilter] = useState('');
  const [pulseId, setPulseId] = useState<string | null>(primaryAnomalyId || highlightIds[0] || null);

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

  const roleOf = (id: string): SparePartRole | 'none' => {
    if (id === primaryAnomalyId) return 'primary-anomaly';
    if (correctedIds.includes(id)) return 'corrected';
    if (normalIds.includes(id)) return 'normal';
    return 'none';
  };

  const filtered = parts.filter(
    (p) =>
      !filter ||
      p.id.toLowerCase().includes(filter.toLowerCase()) ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.spec.toLowerCase().includes(filter.toLowerCase())
  );

  // 排序：原始异常对象置顶，然后修正对照，然后普通关联，然后其他
  const sorted = [...filtered].sort((a, b) => {
    const order: Record<SparePartRole | 'none', number> = {
      'primary-anomaly': 0,
      corrected: 1,
      normal: 2,
      none: 3,
    };
    return order[roleOf(a.id)] - order[roleOf(b.id)];
  });

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-gradient-to-r from-red-700 via-blue-900 to-blue-950 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/15 border border-white/25 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                备件清单 · 原始对象溯源（SOURCE OF TRUTH）
              </div>
              <div className="text-[11px] text-blue-200 mt-0.5">
                顶部黄色闪烁行 = 本次异常的溯源终点（原始备件/脏数据）。修正后对象在次级位置，不可替代原始来源。
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-gradient-to-r from-zinc-100 to-amber-50 border-b border-zinc-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="按备件编号 / 名称 / 规格搜索原始对象..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {primaryAnomalyId && (
            <div className="text-xs font-semibold text-white bg-red-600 px-3 py-1.5 rounded shadow-sm border border-red-700 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              🔴 溯源终点 · {primaryAnomalyId}（行黄色闪烁 3 次）
            </div>
          )}
          {correctedIds.length > 0 && (
            <div className="text-xs font-semibold text-zinc-700 bg-zinc-200 px-3 py-1.5 rounded border border-zinc-300 inline-flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              修正后对照：{correctedIds.join(' / ')}
            </div>
          )}
          {normalIds.length > 0 && (
            <div className="text-xs font-semibold text-blue-800 bg-blue-100 px-3 py-1.5 rounded border border-blue-300 inline-flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              普通关联：{normalIds.join(' / ')}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-200 text-zinc-800 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold w-28">编号</th>
                <th className="px-4 py-3 text-left font-semibold">溯源角色</th>
                <th className="px-4 py-3 text-left font-semibold">备件名称</th>
                <th className="px-4 py-3 text-left font-semibold">规格型号</th>
                <th className="px-4 py-3 text-left font-semibold">原始来源</th>
                <th className="px-4 py-3 text-left font-semibold">批次号</th>
                <th className="px-4 py-3 text-right font-semibold w-16">数量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[12px]">
              {sorted.map((p) => {
                const role = roleOf(p.id);
                const badge = roleBadge[role];
                const Icon = badge.Icon;
                const isPulse = pulseId === p.id;
                const isPrimary = role === 'primary-anomaly';
                const isHighlight =
                  role !== 'none' || highlightIds.includes(p.id);
                const isDirty = !p.spec || !p.batch;
                return (
                  <tr
                    key={p.id}
                    className={clsx(
                      'transition-colors',
                      isPulse && 'bg-yellow-300',
                      !isPulse && isPrimary && 'bg-red-50 border-l-4 border-l-red-500',
                      !isPulse && !isPrimary && role === 'corrected' && 'bg-zinc-50 border-l-4 border-l-zinc-400',
                      !isPulse && !isPrimary && role === 'normal' && 'bg-blue-50/40',
                      !isPulse && isHighlight && 'bg-yellow-50',
                      !isHighlight && !isPulse && 'hover:bg-blue-50/40'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded font-bold',
                          isPrimary
                            ? 'bg-red-600 text-white'
                            : role === 'corrected'
                              ? 'bg-zinc-300 text-zinc-800'
                              : role === 'normal'
                                ? 'bg-blue-200 text-blue-900'
                                : 'text-blue-700'
                        )}
                      >
                        {p.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold',
                          badge.cls
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      {roleLabels[p.id] && (
                        <div className="mt-1 text-[10px] text-zinc-500 leading-snug max-w-[220px] font-sans">
                          {roleLabels[p.id]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-800">{p.name}</td>
                    <td className="px-4 py-3">
                      {p.spec ? (
                        <span className="text-zinc-700">{p.spec}</span>
                      ) : (
                        <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 font-bold">
                          ⚠️ 空字段（脏数据）
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-[11px]">{p.origin}</td>
                    <td className="px-4 py-3">
                      {p.batch ? (
                        <span className="text-zinc-600">{p.batch}</span>
                      ) : (
                        <span className="text-red-700 text-[11px] font-bold">⚠️ 空</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-800">{p.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 text-[11px] text-zinc-600 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              � 原始异常对象 — 结论依据，溯源终点
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-zinc-300" />
              ⚪ 修正后 — 仅作对照，不可替代
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-yellow-300" />
              闪烁行 = 你从详情页点过来的目标
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-zinc-600 font-bold">
            <ExternalLink className="w-3 h-3" />
            SOURCE_OF_TRUTH
          </span>
        </div>
      </div>
    </div>
  );
}
