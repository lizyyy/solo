import { motion } from 'framer-motion';
import { RotateCcw, SlidersHorizontal, Sparkles, Info } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { ImportSimulator } from './ImportSimulator';

function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none group">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium text-ink/80">{label}</span>
        {hint && (
          <span title={hint} className="text-ink/40 group-hover:text-ink/70 transition-colors">
            <Info className="h-3 w-3" />
          </span>
        )}
      </div>
      <span
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? 'bg-kelp' : 'bg-ink/15'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-sand shadow-sm transform transition-transform ${
            value ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-ink/80">{label}</span>
          {hint && (
            <span title={hint} className="text-ink/40 hover:text-ink/70">
              <Info className="h-3 w-3" />
            </span>
          )}
        </div>
        <span className="text-[12px] font-mono font-semibold text-sea-deep bg-sea-foam/40 px-2 py-0.5 rounded-full">
          {value}
          {unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sea-slider"
      />
    </div>
  );
}

export function ParamPanel() {
  const params = useReplayStore((s) => s.params);
  const setParam = useReplayStore((s) => s.setParam);
  const rerun = useReplayStore((s) => s.rerunWithParams);
  const snapshots = useReplayStore((s) => s.snapshots);
  const activeVersion = useReplayStore((s) => s.activeVersion);
  const highlight = useReplayStore((s) => s.highlightRecordIds);

  const lastSnap = snapshots[snapshots.length - 1];
  const diffCount = lastSnap?.diffFromPrev?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.08, ease: 'easeOut' }}
      className="panel-glass rounded-2xl p-5 shadow-soft"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-sea-deep text-kelp-soft flex items-center justify-center">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-ink">参数控制</h3>
            <p className="text-[11px] text-ink/60 font-mono">
              调整后点"重跑"生成 {activeVersion} 的下一版本快照
            </p>
          </div>
        </div>
        {diffCount > 0 && (
          <span className="badge bg-coral/10 text-coral border border-coral/40 animate-blinkDiff">
            <Sparkles className="h-3 w-3" />
            上版变更 {diffCount} 项
          </span>
        )}
      </div>

      <div className="space-y-4">
        <Slider
          label="平滑窗口"
          hint="越大越能抑制短期噪声"
          value={params.smoothWindow}
          min={1}
          max={15}
          step={1}
          onChange={(v) => setParam('smoothWindow', v)}
        />
        <Slider
          label="离群阈值系数 (IQR×)"
          hint="越大判定越宽松，保留更多可疑点"
          value={params.outlierThreshold}
          min={1.0}
          max={4.0}
          step={0.1}
          onChange={(v) => setParam('outlierThreshold', v)}
        />
        <Slider
          label="命名模糊匹配 %"
          hint="低于阈值的站点名判定为命名不一致"
          value={params.nameFuzzyMatch}
          min={50}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => setParam('nameFuzzyMatch', v)}
        />
        <div className="h-px bg-sand-tide/50 my-3" />
        <Toggle
          label="自动归一化潮位单位"
          hint="关闭时标出单位混写的来源行"
          value={params.normalizeUnit}
          onChange={(v) => setParam('normalizeUnit', v)}
        />
        <Toggle
          label="保留可疑点（不直接删）"
          hint="对疑似噪声仅标记，留人工判断"
          value={params.keepSuspicious}
          onChange={(v) => setParam('keepSuspicious', v)}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={rerun}
          className="group flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 bg-sea-deep hover:bg-ink text-sand text-[13px] font-semibold shadow-soft transition-all relative overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-sea-mid via-kelp to-sea-mid opacity-0 group-hover:opacity-20 transition-opacity" />
          <RotateCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
          按当前参数重跑
        </button>
      </div>

      {highlight.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 rounded-xl border border-coral/30 bg-coral/5 p-3"
        >
          <p className="text-[11px] font-mono text-coral leading-relaxed">
            本次重跑后 <b>{highlight.length}</b> 条记录状态发生变化，
            时序图与记录区已高亮。
          </p>
        </motion.div>
      )}

      <div className="mt-5">
        <ImportSimulator />
      </div>
    </motion.div>
  );
}
