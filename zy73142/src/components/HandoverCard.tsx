import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  Download,
  FileWarning,
  Hand,
  MapPin,
  Package,
  Search,
  X,
} from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';

export function HandoverCard() {
  const open = useReplayStore((s) => s.handoverOpen);
  const setOpen = useReplayStore((s) => s.openHandover);
  const locateFirst = useReplayStore((s) => s.locateFirstAnomaly);
  const openDiff = useReplayStore((s) => s.openDiffDrawer);
  const exportCSV = useReplayStore((s) => s.exportCSV);
  const activeVersion = useReplayStore((s) => s.activeVersion);
  const records = useReplayStore((s) => s.records);

  const handleExport = () => {
    const csv = exportCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `海草床调查时序回放_${activeVersion}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampleCount = records.filter(
    (r) =>
      r.flags.isOutlier ||
      r.flags.isUnitMismatch ||
      r.flags.isNameMismatch
  ).length;

  const anomalyCount = records.filter(
    (r) =>
      r.flags.isOutlier ||
      r.flags.isUnitMismatch ||
      r.flags.isNameMismatch ||
      r.flags.isPendingMaterial
  ).length;

  if (!open) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-30 rounded-2xl bg-amber-tide text-ink shadow-[0_10px_30px_-8px_rgba(232,145,58,0.65)] px-4 py-3 flex items-center gap-3 border border-amber-tide/60"
      >
        <div className="h-9 w-9 rounded-xl bg-ink/15 flex items-center justify-center">
          <Hand className="h-5 w-5" />
        </div>
        <div className="text-left">
          <div className="text-[12px] font-bold leading-tight">接班指引</div>
          <div className="text-[10.5px] opacity-80 font-mono leading-tight">
            样例 · 异常 · 导出
          </div>
        </div>
        <ChevronUp className="h-4 w-4 opacity-80" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="fixed right-6 bottom-6 z-30 w-[340px] rounded-3xl border border-sand-tide/60 bg-sand shadow-[0_20px_60px_-12px_rgba(14,31,39,0.5)] overflow-hidden"
      >
        <div className="bg-gradient-to-br from-amber-tide to-amber-soft text-ink px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-ink/15 border border-ink/15 flex items-center justify-center">
              <Hand className="h-6 w-6" />
            </div>
            <div>
              <div className="title-serif text-[22px] leading-none">
                阿乔接班卡
              </div>
              <div className="text-[11px] font-mono opacity-80 mt-1">
                只需知道三件事：样例在哪 / 异常在哪 / 怎么导出
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="h-8 w-8 rounded-full bg-ink/15 flex items-center justify-center hover:bg-ink/25 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <button
            onClick={() => {
              openDiff(true);
              setOpen(false);
            }}
            className="group w-full rounded-2xl border border-kelp/35 bg-kelp/8 p-4 text-left hover:bg-kelp/15 hover:border-kelp/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-kelp text-sand flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink flex items-center gap-2">
                  1. 样例数据在哪？
                  <span className="badge bg-kelp/20 text-kelp-dark border border-kelp/40">
                    {sampleCount} 条脏数据样例
                  </span>
                </div>
                <div className="text-[11px] text-ink/70 font-mono leading-snug mt-0.5">
                  打开版本对比器 v1→v3 可看到 3 个参数快照，含命名不一致（海沟湾三号）、潮位 cm 混写、离群噪声点。
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              locateFirst();
              setOpen(false);
            }}
            className="group w-full rounded-2xl border border-coral/35 bg-coral/8 p-4 text-left hover:bg-coral/15 hover:border-coral/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-coral text-sand flex items-center justify-center group-hover:scale-110 transition-transform">
                <Search className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink flex items-center gap-2">
                  2. 异常在哪？
                  <span className="badge bg-coral/20 text-coral border border-coral/40">
                    <FileWarning className="h-3 w-3" /> 共 {anomalyCount} 条
                  </span>
                </div>
                <div className="text-[11px] text-ink/70 font-mono leading-snug mt-0.5">
                  自动跳到第一条异常：来源行、影响范围、单位混写全部保留；离群点不删除，只打红色气泡标签。
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              handleExport();
              setOpen(false);
            }}
            className="group w-full rounded-2xl border border-sea-light/50 bg-sea-light/10 p-4 text-left hover:bg-sea-light/20 hover:border-sea-mid transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sea-deep text-sea-foam flex items-center justify-center group-hover:scale-110 transition-transform">
                <Download className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink flex items-center gap-2">
                  3. 结果怎么导出？
                  <span className="badge bg-sea-light/25 text-sea-deep border border-sea-light/50">
                    CSV + 截图
                  </span>
                </div>
                <div className="text-[11px] text-ink/70 font-mono leading-snug mt-0.5">
                  一键下载含来源行、异常标签、人工改判列的 CSV；截图保存当前三段式记录区即可。
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-xl bg-ink/5 border border-dashed border-ink/15 p-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-amber-tide mt-0.5 flex-shrink-0" />
              <p className="text-[11px] font-mono text-ink/75 leading-relaxed">
                接手同事：先在参数面板调参数 → 点"按当前参数重跑"→ 打开"版本对比器"看差异列闪烁 → 变化点自动在时序图上虚线圈高亮。
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
