import { motion, AnimatePresence } from 'framer-motion';
import { Database, ShieldCheck, CheckCircle2, FileWarning } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';

export function ImportSimulator() {
  const lastResult = useReplayStore((s) => s.lastImportResult);
  const runSim = useReplayStore((s) => s.runImportSimulation);

  return (
    <div className="rounded-xl border border-sand-tide/60 bg-sand/50 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-sea-mid" />
          <h4 className="text-[12px] font-semibold text-ink">重复导入试跑</h4>
        </div>
        <span className="badge bg-sea-foam/40 text-sea-deep border border-sea-light/30">
          现场数据样式
        </span>
      </div>

      <p className="text-[11px] text-ink/60 font-mono leading-relaxed mb-3">
        按现场会收到的样子再次导入同一批次，验证记录不翻倍、人工备注不被覆盖。
      </p>

      <button
        onClick={runSim}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 bg-amber-tide hover:bg-amber-tide/90 text-ink text-[12px] font-semibold transition-all"
      >
        <FileWarning className="h-4 w-4" />
        模拟重复导入批次
      </button>

      <AnimatePresence>
        {lastResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mt-3 space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-ink/5 p-2">
                <div className="text-[10px] text-ink/50 font-mono">输入</div>
                <div className="text-[14px] font-bold text-ink font-mono">
                  {lastResult.totalIncoming} 条
                </div>
              </div>
              <div className="rounded-lg bg-kelp/10 p-2">
                <div className="flex items-center gap-1 text-[10px] text-kelp-dark font-mono">
                  <ShieldCheck className="h-3 w-3" />
                  跳过重复
                </div>
                <div className="text-[14px] font-bold text-kelp-dark font-mono">
                  {lastResult.skippedDuplicate} 条
                </div>
              </div>
              <div className="rounded-lg bg-sea-light/20 p-2">
                <div className="flex items-center gap-1 text-[10px] text-sea-deep font-mono">
                  <CheckCircle2 className="h-3 w-3" />
                  备注保留
                </div>
                <div className="text-[14px] font-bold text-sea-deep font-mono">
                  {lastResult.remarkPreserved} 条
                </div>
              </div>
              <div className="rounded-lg bg-amber-tide/20 p-2">
                <div className="text-[10px] text-ink/60 font-mono">新增记录</div>
                <div className="text-[14px] font-bold text-ink font-mono">
                  {lastResult.merged} 条
                </div>
              </div>
            </div>
            <p className="text-[10.5px] text-ink/70 font-mono leading-relaxed">
              指纹键：站点+日期+覆盖度匹配为重复 → 跳过；旧 remark 非空时绝不被新导入覆盖。
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
