import type { HistoryEntry, DiffItem } from '@/types';
import { computeDiff, formatValue } from '@/utils/dataUtils';
import { useState, useMemo } from 'react';
import { GitCompare, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  a: HistoryEntry;
  b: HistoryEntry;
}

export default function DiffView({ a, b }: Props) {
  const diffs: DiffItem[] = useMemo(() => computeDiff(a.snapshot, b.snapshot), [a, b]);
  const [hideUnchanged, setHideUnchanged] = useState(true);
  const [showSupplements, setShowSupplements] = useState(true);
  const [showVaccines, setShowVaccines] = useState(true);

  const topFieldKeys = ['dogName', 'breed', 'gender', 'age', 'weight', 'weightUnit', 'ownerName', 'ownerPhone', 'conclusion'];

  const changedPaths = new Set(diffs.map(d => d.path));
  const inChanged = (k: string) => changedPaths.has(k);

  const formatField = (k: string, v: unknown, isOld: boolean) => {
    if (k === 'weightUnit') return v as string;
    if (k === 'conclusion') {
      const cls = v === '疫苗合格 可寄养' ? 'text-emerald-600' : v === '待审核' ? 'text-anomaly-500' : 'text-verdict-600';
      return <span className={cls}>{v as string}</span>;
    }
    return <>{formatValue(v)}</>;
  };

  const Cell = ({ k, v, isOld, diff }: { k: string; v: unknown; isOld: boolean; diff?: DiffItem }) => {
    if (hideUnchanged && !diff) return null;
    const changed = !!diff;
    return (
      <div className={cn('py-1.5 px-3 text-sm',
        changed ? (diff!.kind === 'changed' ? 'animate-pulse-soft rounded-md' :
          diff!.kind === 'added' ? 'bg-emerald-50 rounded-md' :
          'bg-red-50 rounded-md') : '')}>
        {changed ? (
          <>
            {diff!.kind === 'added' && <span className="text-[10px] text-emerald-600 font-semibold mr-1.5">新增</span>}
            {diff!.kind === 'removed' && <span className="text-[10px] text-red-600 font-semibold mr-1.5">删除</span>}
            {diff!.kind === 'changed' && isOld && <span className="text-[10px] text-anomaly-600 font-semibold mr-1.5">原值</span>}
            {diff!.kind === 'changed' && !isOld && <span className="text-[10px] text-anomaly-600 font-semibold mr-1.5">新值</span>}
            <span className={cn(
              diff!.kind === 'removed' ? 'line-through text-red-700' : '',
              diff!.kind === 'added' ? 'text-emerald-700 font-medium' : '',
              diff!.kind === 'changed' && isOld ? 'text-anomaly-700 line-through' : '',
              diff!.kind === 'changed' && !isOld ? 'text-anomaly-700 font-semibold' : '',
            )}>{formatField(k, v, isOld)}</span>
          </>
        ) : (
          <span className="text-brand-700">{formatField(k, v, isOld)}</span>
        )}
      </div>
    );
  };

  const headerLabel = (h: HistoryEntry, tag: string) => (
    <div className="flex items-center justify-between">
      <span className="font-mono font-bold text-brand-700">{tag} · v{h.version}</span>
      <span className="text-[11px] text-brand-500">{h.timestamp}</span>
    </div>
  );

  const diffMap = new Map(diffs.map(d => [d.path, d]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-brand-600" />
          <h4 className="font-serif font-bold text-brand-800">字段级差异对比</h4>
          <span className="chip chip-normal">差异 {diffs.length} 处</span>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-brand-600 cursor-pointer select-none">
          {hideUnchanged ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <input type="checkbox" checked={hideUnchanged} onChange={(e) => setHideUnchanged(e.target.checked)} />
          只看变化字段
        </label>
      </div>

      {/* Top fields */}
      <div className="rounded-xl border border-brand-100 overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_1fr] bg-brand-50/80 text-xs font-semibold text-brand-600">
          <div className="px-3 py-2 border-b border-brand-100">字段</div>
          <div className="px-3 py-2 border-b border-brand-100 border-x border-brand-100">{headerLabel(a, 'A')}</div>
          <div className="px-3 py-2 border-b border-brand-100">{headerLabel(b, 'B')}</div>
        </div>
        {topFieldKeys.map(k => {
          const av = (a.snapshot as unknown as Record<string, unknown>)[k];
          const bv = (b.snapshot as unknown as Record<string, unknown>)[k];
          const d = diffMap.get(k);
          if (hideUnchanged && !d) return null;
          const rowChanged = inChanged(k);
          const label: Record<string, string> = {
            dogName: '犬只姓名', breed: '品种', gender: '性别', age: '年龄',
            weight: '体重数值', weightUnit: '体重单位', ownerName: '主人姓名',
            ownerPhone: '联系电话', conclusion: '寄养结论',
          };
          return (
            <div key={k} className={`grid grid-cols-[120px_1fr_1fr] text-sm ${rowChanged ? 'bg-anomaly-50/20' : ''}`}>
              <div className="px-3 py-1.5 text-xs font-medium text-brand-500 border-t border-brand-50 self-center">
                {label[k] || k}
                {d && <span className="ml-1 chip chip-anomaly text-[10px] px-1.5">变</span>}
              </div>
              <div className="border-x border-brand-50 border-t border-brand-50">
                <Cell k={k} v={av} isOld diff={d} />
              </div>
              <div className="border-t border-brand-50">
                <Cell k={k} v={bv} isOld={false} diff={d} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Vaccines */}
      <div className="rounded-xl border border-brand-100 overflow-hidden">
        <button
          onClick={() => setShowVaccines(!showVaccines)}
          className="w-full px-4 py-2 flex items-center justify-between bg-brand-50/80 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        >
          <span>疫苗记录对比（A: {a.snapshot.vaccines.length} 针 → B: {b.snapshot.vaccines.length} 针）</span>
          {showVaccines ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showVaccines && (
          <div className="divide-y divide-brand-50">
            {Array.from({ length: Math.max(a.snapshot.vaccines.length, b.snapshot.vaccines.length) }).map((_, i) => {
              const av = a.snapshot.vaccines[i];
              const bv = b.snapshot.vaccines[i];
              const anyV = av || bv;
              if (!anyV) return null;
              const hasChange =
                !av || !bv ||
                av.name !== bv.name || av.date !== bv.date || av.expireDate !== bv.expireDate ||
                av.attachmentName !== bv.attachmentName || !!av.attachmentArrivedLate !== !!bv.attachmentArrivedLate;
              if (hideUnchanged && !hasChange) return null;

              const chipRow = (label: string, x: string | boolean | undefined, y: string | boolean | undefined, key: string) => {
                const changed = String(x ?? '') !== String(y ?? '');
                if (hideUnchanged && !changed) return null;
                const fmt = (v: string | boolean | undefined) => typeof v === 'boolean' ? (v ? '是' : '否') : (v || '—');
                return (
                  <div className="text-[11px] py-0.5">
                    <span className="text-brand-400 mr-1">{label}</span>
                    {changed ? (
                      <>
                        <span className="diff-removed">{fmt(x)}</span>
                        <span className="mx-1 text-brand-400">→</span>
                        <span className="diff-added">{fmt(y)}</span>
                      </>
                    ) : <span className="text-brand-600">{fmt(x)}</span>}
                  </div>
                );
              };

              return (
                <div key={i} className={`p-3 ${hasChange ? 'bg-anomaly-50/20' : ''}`}>
                  <div className="text-xs font-semibold text-brand-700 mb-2 flex items-center gap-2">
                    第 {i + 1} 针
                    {hasChange && <span className="chip chip-anomaly text-[10px] px-1.5">有变更</span>}
                    {!av && <span className="chip chip-normal text-[10px]">B 新增</span>}
                    {!bv && <span className="chip chip-verdict text-[10px]">B 删除</span>}
                  </div>
                  <div className="space-y-0.5">
                    {chipRow('疫苗名', av?.name, bv?.name, 'name')}
                    {chipRow('接种日', av?.date, bv?.date, 'date')}
                    {chipRow('有效期', av?.expireDate, bv?.expireDate, 'expireDate')}
                    {chipRow('附件', av?.attachmentName, bv?.attachmentName, 'att')}
                    {chipRow('晚到', av?.attachmentArrivedLate, bv?.attachmentArrivedLate, 'late')}
                    {((av?.attachmentNote || bv?.attachmentNote)) && chipRow('备注', av?.attachmentNote, bv?.attachmentNote, 'note')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supplements */}
      <div className="rounded-xl border border-brand-100 overflow-hidden">
        <button
          onClick={() => setShowSupplements(!showSupplements)}
          className="w-full px-4 py-2 flex items-center justify-between bg-brand-50/80 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        >
          <span>补录备注对比（A: {a.snapshot.supplements.length} 条 → B: {b.snapshot.supplements.length} 条）</span>
          {showSupplements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSupplements && (
          <div className="p-3 space-y-2">
            {b.snapshot.supplements.length === 0 && a.snapshot.supplements.length === 0 && (
              <div className="text-xs italic text-brand-400">无补录备注</div>
            )}
            {Array.from({ length: Math.max(a.snapshot.supplements.length, b.snapshot.supplements.length) }).map((_, i) => {
              const as_ = a.snapshot.supplements[i];
              const bs = b.snapshot.supplements[i];
              const isNew = !as_ && bs;
              if (hideUnchanged && !isNew) return null;
              return (
                <div key={i} className={cn(
                  'rounded-lg p-3 border text-xs',
                  isNew ? 'bg-emerald-50 border-emerald-100' : 'bg-brand-50 border-brand-100'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-brand-700">
                      {isNew ? '🆕 B 新增备注' : `第 ${i + 1} 条`}
                    </span>
                    <span className="text-brand-400">{bs?.operator || as_?.operator} · {bs?.time || as_?.time}</span>
                  </div>
                  {isNew ? (
                    <div className="text-emerald-800 leading-relaxed">{bs!.content}</div>
                  ) : (
                    <div className="text-brand-700 leading-relaxed">{as_!.content}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
