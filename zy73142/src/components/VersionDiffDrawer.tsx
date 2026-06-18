import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  GitCompareArrows,
  Layers,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import type { ParamSnapshot, RunParams } from '@/types';
import { cn } from '@/lib/utils';

const PARAM_LABELS: Record<keyof RunParams, { label: string; hint: string; format: (v: any) => string }> = {
  smoothWindow: { label: '平滑窗口', hint: '越大越抑制噪声', format: (v) => `${v} 点` },
  outlierThreshold: { label: '离群阈值系数', hint: 'IQR × 倍数', format: (v) => `×${Number(v).toFixed(1)}` },
  nameFuzzyMatch: { label: '命名模糊匹配', hint: '低于阈值判为不一致', format: (v) => `${v}%` },
  normalizeUnit: { label: '自动归一化单位', hint: '关闭时标出来源行', format: (v) => (v ? '开启' : '关闭') },
  keepSuspicious: { label: '保留可疑点', hint: '不直接删，仅标记', format: (v) => (v ? '开启' : '关闭') },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function DiffCell({
  value,
  isDiff,
  direction,
}: {
  value: string;
  isDiff: boolean;
  direction?: 'up' | 'down';
}) {
  return (
    <div
      className={cn(
        'rounded-lg px-2 py-1.5 text-[12px] font-mono',
        isDiff
          ? cn(
              'bg-coral/12 border border-coral/50 text-coral font-semibold',
              'animate-blinkDiff'
            )
          : 'bg-ink/5 text-ink/80 border border-transparent'
      )}
    >
      {isDiff && direction && (
        <span className="mr-1 text-[10px]">
          {direction === 'up' ? '↑' : '↓'}
        </span>
      )}
      {value}
    </div>
  );
}

export function VersionDiffDrawer() {
  const open = useReplayStore((s) => s.diffDrawerOpen);
  const setOpen = useReplayStore((s) => s.openDiffDrawer);
  const snapshots = useReplayStore((s) => s.snapshots);
  const selected = useReplayStore((s) => s.selectedForCompare);
  const toggle = useReplayStore((s) => s.toggleCompareVersion);
  const rollback = useReplayStore((s) => s.rollbackTo);
  const active = useReplayStore((s) => s.activeVersion);
  const setHighlight = useReplayStore((s) => s.setHighlight);
  const records = useReplayStore((s) => s.records);

  const selectedSnaps = useMemo(
    () => snapshots.filter((s) => selected.includes(s.version)),
    [snapshots, selected]
  );

  const diffMap = useMemo(() => {
    const map: Record<string, Set<keyof RunParams>> = {};
    for (const snap of selectedSnaps) {
      map[snap.version] = new Set();
      for (const d of snap.diffFromPrev ?? []) {
        map[snap.version].add(d.paramKey);
      }
    }
    if (selectedSnaps.length >= 2) {
      const base = selectedSnaps[0];
      for (let i = 1; i < selectedSnaps.length; i++) {
        const curr = selectedSnaps[i];
        const keys = Object.keys(curr.params) as (keyof RunParams)[];
        for (const k of keys) {
          if (base.params[k] !== curr.params[k]) {
            map[curr.version].add(k);
            map[base.version].add(k);
          }
        }
      }
    }
    return map;
  }, [selectedSnaps]);

  const paramKeys = Object.keys(PARAM_LABELS) as (keyof RunParams)[];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink/55 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-sand-tide/40 bg-sand shadow-[0_-20px_60px_-20px_rgba(14,31,39,0.5)]"
            style={{ maxHeight: '78vh' }}
          >
            <div className="mx-auto max-w-[1280px] px-6 pt-4 pb-6 overflow-y-auto scrollbar-thin" style={{ maxHeight: '78vh' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-sea-deep text-kelp-soft flex items-center justify-center animate-floaty">
                    <GitCompareArrows className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="title-serif text-[24px] text-ink leading-none">
                      参数版本对比器
                    </h2>
                    <p className="text-[12px] text-ink/60 font-mono mt-1">
                      勾选 2–3 个版本并排比较，差异单元格闪烁高亮；点版本名可回滚
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 bg-ink/5 border border-ink/10 text-ink/70 hover:bg-ink/10 text-[12px] font-medium transition-all"
                >
                  <ChevronDown className="h-4 w-4" /> 收起
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="panel-dark rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-sand flex items-center gap-2">
                    <Layers className="h-4 w-4 text-kelp-soft" />
                    选择要对比的版本快照
                  </h3>
                  <span className="badge bg-sand/10 text-sand/80 border border-sand/20">
                    {selected.length}/3 已选
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {snapshots.map((s) => {
                    const isSelected = selected.includes(s.version);
                    const isActive = s.version === active;
                    return (
                      <button
                        key={s.version}
                        onClick={() => toggle(s.version)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 border text-left transition-all',
                          isSelected
                            ? 'bg-kelp/20 border-kelp/60 text-sand shadow-glow-kelp'
                            : 'bg-sand/5 border-sand/20 text-sand/75 hover:border-sand/40'
                        )}
                      >
                        <span
                          className={cn(
                            'badge',
                            isActive
                              ? 'bg-amber-tide text-ink border-amber-tide'
                              : 'bg-sand/15 text-sand/85 border-sand/25'
                          )}
                        >
                          <Sparkles className="h-3 w-3" /> {s.version}
                          {isActive && ' · 在用'}
                        </span>
                        <span className="text-[11px] font-mono text-sand/70">
                          {fmt(s.createdAt)}
                        </span>
                        <span className="badge bg-coral/20 text-coral-soft border border-coral/40">
                          <Zap className="h-3 w-3" />
                          影响 {s.affectedRecordIds.length} 条
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedSnaps.length < 2 ? (
                <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center">
                  <Search className="h-8 w-8 mx-auto text-ink/40 mb-3" />
                  <p className="text-[13px] text-ink/60 font-mono">
                    请至少选择 2 个版本进行对比
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-thin -mx-2 px-2">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                      <tr className="text-left">
                        <th className="sticky left-0 bg-sand z-10 py-2 pr-4 min-w-[220px]">
                          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">
                            参数
                          </span>
                        </th>
                        {selectedSnaps.map((snap) => {
                          const diffs = snap.diffFromPrev ?? [];
                          return (
                            <th
                              key={snap.version}
                              className="py-2 px-3 min-w-[200px] align-top"
                            >
                              <div className="rounded-xl bg-sea-deep/95 text-sand p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="title-serif text-[18px] leading-none">
                                    {snap.version}
                                  </span>
                                  <button
                                    onClick={() => rollback(snap.version)}
                                    className={cn(
                                      'badge transition-all',
                                      snap.version === active
                                        ? 'bg-amber-tide text-ink border-amber-tide cursor-default'
                                        : 'bg-sand/15 text-sand border-sand/30 hover:bg-kelp/30 hover:border-kelp'
                                    )}
                                  >
                                    {snap.version === active ? (
                                      <>
                                        <Sparkles className="h-3 w-3" /> 当前版本
                                      </>
                                    ) : (
                                      <>回滚到此</>
                                    )}
                                  </button>
                                </div>
                                <div className="text-[10.5px] font-mono text-sea-foam/75">
                                  {fmt(snap.createdAt)} · 影响{' '}
                                  <button
                                    onClick={() => setHighlight(snap.affectedRecordIds)}
                                    className="underline decoration-dotted hover:text-kelp-soft"
                                    title="在主视图高亮这些记录"
                                  >
                                    {snap.affectedRecordIds.length} 条记录
                                  </button>
                                </div>
                                {diffs.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {diffs.map((d) => {
                                      const up =
                                        typeof d.newValue === 'number' &&
                                        typeof d.oldValue === 'number'
                                          ? d.newValue > d.oldValue
                                          : undefined;
                                      return (
                                        <span
                                          key={d.paramKey}
                                          className="badge bg-coral/25 text-coral-soft border border-coral/50"
                                        >
                                          {up !== undefined && (up ? '↑' : '↓')}{' '}
                                          {PARAM_LABELS[d.paramKey].label}:{' '}
                                          {PARAM_LABELS[d.paramKey].format(
                                            d.oldValue
                                          )}{' '}
                                          →{' '}
                                          {PARAM_LABELS[d.paramKey].format(
                                            d.newValue
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paramKeys.map((k, idx) => {
                        const info = PARAM_LABELS[k];
                        return (
                          <tr
                            key={k}
                            className={idx % 2 ? '' : ''}
                            style={{
                              borderBottom:
                                '1px solid rgba(201,184,150,0.25)',
                            }}
                          >
                            <td className="sticky left-0 bg-sand z-10 py-2.5 pr-4">
                              <div className="text-[12.5px] font-semibold text-ink">
                                {info.label}
                              </div>
                              <div className="text-[10.5px] text-ink/50 font-mono mt-0.5">
                                {info.hint}
                              </div>
                            </td>
                            {selectedSnaps.map((snap, j) => {
                              const isDiff = diffMap[snap.version]?.has(k);
                              let dir: 'up' | 'down' | undefined;
                              const baseParams = selectedSnaps[0].params;
                              if (
                                j > 0 &&
                                isDiff &&
                                typeof baseParams[k] === 'number' &&
                                typeof snap.params[k] === 'number'
                              ) {
                                dir =
                                  (snap.params[k] as number) >
                                  (baseParams[k] as number)
                                    ? 'up'
                                    : 'down';
                              }
                              return (
                                <td key={snap.version} className="py-2.5 px-3">
                                  <DiffCell
                                    value={info.format(snap.params[k])}
                                    isDiff={!!isDiff}
                                    direction={dir}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr>
                        <td className="sticky left-0 bg-sand z-10 py-3 pr-4">
                          <div className="text-[12.5px] font-semibold text-ink">
                            本版变化影响
                          </div>
                          <div className="text-[10.5px] text-ink/50 font-mono mt-0.5">
                            点击后在主视图高亮
                          </div>
                        </td>
                        {selectedSnaps.map((snap) => {
                          const changed = snap.affectedRecordIds
                            .slice(0, 5)
                            .map((id) => {
                              const r = records.find((x) => x.id === id);
                              if (!r) return id;
                              return `${r.id.slice(-3)} · ${r.siteName}`;
                            });
                          return (
                            <td key={snap.version} className="py-3 px-3 align-top">
                              <button
                                onClick={() => setHighlight(snap.affectedRecordIds)}
                                className="rounded-lg px-2 py-2 bg-kelp/10 border border-kelp/30 text-left w-full hover:bg-kelp/20 transition-colors"
                              >
                                <div className="text-[12px] font-semibold text-kelp-dark mb-1">
                                  {snap.affectedRecordIds.length} 条记录
                                </div>
                                <div className="text-[10.5px] font-mono text-ink/70 leading-snug">
                                  {changed.length === 0
                                    ? '（与上一版无状态变化）'
                                    : changed.join('；') +
                                      (snap.affectedRecordIds.length >
                                      changed.length
                                        ? '…等'
                                        : '')}
                                </div>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
