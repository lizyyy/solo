import { useState } from 'react';
import { Gavel, X } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Button, Tag, SectionLabel, Card } from './primitives';

export function OverridePanel({ runId }: { runId: string }) {
  const override = useReplayStore((s) => s.overrides[runId]);
  const setOverride = useReplayStore((s) => s.setOverride);
  const removeOverride = useReplayStore((s) => s.removeOverride);
  const [reason, setReason] = useState('');

  if (override) {
    return (
      <Card glow="accent" className="border-accent/30">
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>人工改判</SectionLabel>
          <Tag tone="accent">已改判 · 仅计一次</Tag>
        </div>
        <p className="text-sm leading-relaxed text-ink-100">{override.reason}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
          <span>
            {override.by} · {new Date(override.overriddenAt).toLocaleString('zh-CN')}
          </span>
          <button
            type="button"
            onClick={() => removeOverride(runId)}
            className="flex items-center gap-1 rounded-sm px-2 py-1 text-ink-300 hover:bg-white/5 hover:text-alert"
          >
            <X className="h-3 w-3" />
            撤销改判
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionLabel hint="幂等：同 runId 重复改判只算一份">人工改判</SectionLabel>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="改判理由，例如：奇异矩阵，除零属预期，按人工改判通过"
        rows={2}
        className="mb-2 w-full resize-none rounded-sm border border-white/10 bg-ink-900/70 p-2 text-xs text-ink-200 outline-none focus:border-accent/60"
      />
      <Button
        variant="primary"
        onClick={() => {
          if (reason.trim()) {
            setOverride(runId, reason.trim(), '算法值班');
            setReason('');
          }
        }}
        disabled={!reason.trim()}
      >
        <Gavel className="h-4 w-4" />
        标记人工改判
      </Button>
    </Card>
  );
}
