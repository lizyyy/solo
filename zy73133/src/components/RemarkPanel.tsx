import { useMemo } from 'react';
import { MessageSquarePlus, Sparkles, GitCompareArrows, AlertCircle } from 'lucide-react';
import { useTidalStore, SAMPLE_REMARK_TEXT } from '@/store/useTidalStore';
import { parseRemarkCorrections } from '@/engine/pipeline';
import { cn } from '@/lib/utils';

export function RemarkPanel() {
  const batch = useTidalStore((s) => s.batch);
  const remarkDraft = useTidalStore((s) => s.remarkDraft);
  const setRemarkDraft = useTidalStore((s) => s.setRemarkDraft);
  const remarkTargetId = useTidalStore((s) => s.remarkTargetId);
  const setRemarkTarget = useTidalStore((s) => s.setRemarkTarget);
  const applyRemark = useTidalStore((s) => s.applyRemark);
  const lastVersion = useTidalStore((s) => s.lastVersion);

  const target = useMemo(() => {
    if (!batch || !remarkTargetId) return null;
    return batch.annotations.find((a) => a.annotationId === remarkTargetId) ?? null;
  }, [batch, remarkTargetId]);

  const detection = useMemo(() => parseRemarkCorrections(remarkDraft), [remarkDraft]);

  if (!remarkTargetId || !target) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MessageSquarePlus className="h-8 w-8 text-glow-teal/40" />
        <p className="font-mono text-[11px] text-signal-moon/40">在站点详情中点击「追加备注」</p>
        <p className="font-mono text-[10px] text-signal-moon/30">补一条备注后会重跑判断并给出前后变化</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-signal-moon/40">备注目标站点</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-display text-sm font-bold text-glow-cyan">{target.stationName}</span>
          <span className="rounded bg-glow-deep/20 px-1.5 py-0.5 font-mono text-[10px] text-glow-teal">
            v{batch?.currentVersion} → v{(batch?.currentVersion ?? 1) + 1}
          </span>
        </div>
      </div>

      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-signal-moon/50">
        人工备注（支持「减去0.5m」「修正为2.3m」等规则）
      </label>
      <textarea
        value={remarkDraft}
        onChange={(e) => setRemarkDraft(e.target.value)}
        rows={4}
        placeholder="例：现场复核，原读数偏高，实际潮位修正为 2.3m，传感器需校准"
        className="w-full resize-none rounded-lg border border-glow-teal/30 bg-abyss-900/70 p-2.5 font-mono text-[11px] text-signal-moon placeholder:text-signal-moon/25 focus:border-glow-cyan/60 focus:outline-none focus:ring-1 focus:ring-glow-cyan/40"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setRemarkDraft(SAMPLE_REMARK_TEXT)}
          className="flex items-center gap-1 rounded-md border border-glow-teal/30 bg-glow-deep/20 px-2 py-1 font-mono text-[10px] text-glow-teal hover:bg-glow-deep/30"
        >
          <Sparkles className="h-3 w-3" /> 填入示例备注
        </button>
        <button
          onClick={() => setRemarkTarget(null)}
          className="rounded-md border border-signal-moon/15 px-2 py-1 font-mono text-[10px] text-signal-moon/50 hover:text-signal-moon"
        >
          取消
        </button>
      </div>

      {/* Detected correction rule preview */}
      <div className={cn(
        'mt-3 rounded-lg border p-2.5',
        detection.found ? 'border-glow-cyan/40 bg-glow-cyan/5' : 'border-signal-amber/30 bg-signal-amber/5',
      )}>
        <p className="font-mono text-[10px] uppercase tracking-wider text-signal-moon/50">规则识别预览</p>
        <p className={cn(
          'mt-1 font-mono text-[11px] leading-relaxed',
          detection.found ? 'text-glow-cyan' : 'text-signal-amber/90',
        )}>
          {detection.found ? '✓ ' : '△ '}{detection.description}
        </p>
        {!detection.found && (
          <p className="mt-1 font-mono text-[10px] text-signal-moon/40">
            未识别到潮位修正规则，备注将作为说明性文字追加
          </p>
        )}
      </div>

      <button
        onClick={applyRemark}
        disabled={!remarkDraft.trim()}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 font-mono text-[11px] font-semibold transition-all',
          remarkDraft.trim()
            ? 'border-glow-cyan/50 bg-glow-cyan/15 text-glow-cyan hover:bg-glow-cyan/25 shadow-glow'
            : 'cursor-not-allowed border-signal-moon/10 text-signal-moon/30',
        )}
      >
        <GitCompareArrows className="h-4 w-4" />
        应用备注并重新生成判断
      </button>

      {/* Change report */}
      {lastVersion && (
        <ChangeReport />
      )}
    </div>
  );
}

function ChangeReport() {
  const lastVersion = useTidalStore((s) => s.lastVersion);
  if (!lastVersion) return null;

  const deltas = lastVersion.deltas;
  const stillNeedReview = deltas.filter((d) => !d.judgmentImpact.includes('发生变更'));

  return (
    <section className="mt-4 rounded-lg border border-glow-teal/30 bg-abyss-800/60 p-3 animate-riseIn">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-glow-cyan/80">
        <GitCompareArrows className="h-3 w-3" /> 补充前后变化报告 · v{lastVersion.versionNumber}
      </h3>
      <p className="mb-2 font-mono text-[10px] text-signal-moon/50">
        备注：{lastVersion.appliedRemark}
      </p>

      {deltas.length === 0 ? (
        <p className="rounded bg-glow-deep/20 p-2 font-mono text-[10px] text-glow-teal">
          本次备注未改变任何判断结果
        </p>
      ) : (
        <div className="space-y-2">
          {deltas.map((d, i) => (
            <div key={i} className="rounded-md border border-glow-teal/20 bg-abyss-900/60 p-2">
              <p className="font-mono text-[11px] font-semibold text-signal-moon">{d.fieldChanged}</p>
              <div className="mt-1 flex items-start gap-2 font-mono text-[10px]">
                <span className="text-signal-coral/80 line-through opacity-70">{truncate(d.oldValue)}</span>
                <span className="text-glow-cyan/60">→</span>
                <span className="text-glow-cyan">{truncate(d.newValue)}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-signal-amber/80">影响：{d.judgmentImpact}</p>
            </div>
          ))}
        </div>
      )}

      {stillNeedReview.length === 0 && deltas.length > 0 && (
        <p className="mt-2 flex items-center gap-1 rounded bg-glow-cyan/10 p-2 font-mono text-[10px] text-glow-cyan">
          <AlertCircle className="h-3 w-3" /> 仍需人工确认：原始日志格式问题未随备注消除，建议核对传感器原始读数
        </p>
      )}
    </section>
  );
}

function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
