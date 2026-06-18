import { motion } from 'framer-motion';
import {
  Anchor,
  Download,
  Hand,
  History,
  Waves,
  GitCompareArrows,
} from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';

export function HeaderBar() {
  const openDiff = useReplayStore((s) => s.openDiffDrawer);
  const openHandover = useReplayStore((s) => s.openHandover);
  const activeVersion = useReplayStore((s) => s.activeVersion);
  const exportCSV = useReplayStore((s) => s.exportCSV);
  const records = useReplayStore((s) => s.records);

  const handleExport = () => {
    const csv = exportCSV();
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `海草床调查时序回放_${activeVersion}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const anomalyCount = records.filter(
    (r) =>
      r.flags.isOutlier ||
      r.flags.isUnitMismatch ||
      r.flags.isNameMismatch ||
      r.flags.isPendingMaterial
  ).length;

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative z-20 px-8 pt-8 pb-4"
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-kelp to-sea-light shadow-soft flex items-center justify-center text-sand animate-floaty">
            <Anchor className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="title-serif text-[34px] leading-none text-sand">
                海草床调查时序回放
              </h1>
              <span className="badge bg-sea-mid/60 text-sea-foam border border-sea-light/30">
                <Waves className="h-3 w-3" />
                当前版本 {activeVersion}
              </span>
              <span className="badge bg-coral/15 text-coral-soft border border-coral/40">
                <History className="h-3 w-3" />
                {anomalyCount} 条待关注异常
              </span>
            </div>
            <p className="mt-2 text-[13px] text-sea-foam/80 font-mono tracking-wide">
              站点：海沟湾站1号 / 2号 / 3号 · 调查批次：B2024Q1–Q2 · 共 {records.length} 条时序记录
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openDiff(true)}
            className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium bg-panel-dark text-sand border border-sea-light/30 hover:border-kelp/60 hover:text-kelp transition-all"
          >
            <GitCompareArrows className="h-4 w-4" />
            版本对比
          </button>
          <button
            onClick={handleExport}
            className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium bg-kelp hover:bg-kelp-dark text-sand shadow-soft transition-all"
          >
            <Download className="h-4 w-4" />
            导出结果
          </button>
          <button
            onClick={() => openHandover(true)}
            className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium bg-amber-tide hover:bg-amber-tide/90 text-ink shadow-soft transition-all"
          >
            <Hand className="h-4 w-4" />
            接班指引
          </button>
        </div>
      </div>
    </motion.header>
  );
}
