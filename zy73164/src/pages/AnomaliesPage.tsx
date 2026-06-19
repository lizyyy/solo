import { useMemo } from 'react';
import { AlertOctagon } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { computeAnomalies } from '@/lib/anomalies';
import { Card, SectionLabel, Stat, Tag } from '@/components/primitives';
import { AnomalyList } from '@/components/AnomalyList';

export function AnomaliesPage() {
  const runs = useReplayStore((s) => s.runs);
  const results = useReplayStore((s) => s.results);
  const anomalies = useMemo(() => computeAnomalies({ runs, results }), [runs, results]);

  const counts = useMemo(() => {
    const c = { empty_set: 0, div_zero: 0, pending_review: 0, residual: 0 };
    for (const a of anomalies) c[a.kind]++;
    return c;
  }, [anomalies]);

  const sourceLines = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of anomalies) {
      if (a.sourceFile && a.sourceLine) {
        const k = `${a.sourceFile}:${a.sourceLine}`;
        map.set(k, (map.get(k) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [anomalies]);

  return (
    <div className="space-y-5">
      <Card glow={anomalies.length ? 'alert' : undefined}>
        <div className="flex items-center gap-3">
          <AlertOctagon className="h-5 w-5 text-alert" />
          <div>
            <div className="text-sm font-semibold text-ink-100">异常看板</div>
            <p className="text-xs text-muted">
              空集合历史答案被拦截为异常；除零边界记录影响范围与来源行，替代人眼扫描。
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="异常总数" value={String(anomalies.length)} tone={anomalies.length ? 'alert' : 'ok'} />
        <Stat label="空集合" value={String(counts.empty_set)} tone={counts.empty_set ? 'alert' : 'ok'} />
        <Stat label="除零边界" value={String(counts.div_zero)} tone={counts.div_zero ? 'warn' : 'ok'} />
        <Stat label="待复核" value={String(counts.pending_review)} tone={counts.pending_review ? 'warn' : 'ok'} />
        <Stat label="误差超阈" value={String(counts.residual)} tone={counts.residual ? 'warn' : 'ok'} />
      </div>

      {sourceLines.length > 0 && (
        <Card>
          <SectionLabel hint="来源行命中聚合：定位需要人眼复核的代码位置">除零边界 · 来源行汇总</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {sourceLines.map(([line, n]) => (
              <div
                key={line}
                className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1"
              >
                <span className="mono text-[11px] text-accent">{line}</span>
                <Tag tone={n >= 2 ? 'alert' : 'warn'}>×{n}</Tag>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AnomalyList />
    </div>
  );
}
