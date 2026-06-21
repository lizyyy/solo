import { useMemo } from 'react';
import { AlertTriangle, Crosshair, FileWarning, ClipboardCheck, Gauge } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { computeAnomalies } from '@/lib/anomalies';
import { Card, SectionLabel, Tag, StatusDot } from './primitives';
import type { AnomalyItem } from '@/types';

const KIND_META: Record<
  AnomalyItem['kind'],
  { label: string; icon: typeof AlertTriangle; tone: 'alert' | 'warn' | 'accent' | 'ok' }
> = {
  empty_set: { label: '空集合历史答案', icon: FileWarning, tone: 'alert' },
  zero_boundary: { label: '除零边界', icon: Crosshair, tone: 'alert' },
  div_zero: { label: '除零边界', icon: Crosshair, tone: 'alert' },
  pending_review: { label: '改判待复核', icon: ClipboardCheck, tone: 'warn' },
  residual: { label: '误差超阈', icon: Gauge, tone: 'warn' },
};

export function AnomalyList() {
  const runs = useReplayStore((s) => s.runs);
  const results = useReplayStore((s) => s.results);
  const materials = useReplayStore((s) => s.materials);
  const anomalies = useMemo(() => computeAnomalies({ runs, results }), [runs, results]);

  const labelFor = (matrixId?: string) =>
    (matrixId && materials.find((m) => m.matrixId === matrixId)?.label) || matrixId || '—';

  const emptySetAnomalies = anomalies.filter((a) => a.kind === 'empty_set');
  const others = anomalies.filter((a) => a.kind !== 'empty_set');

  if (anomalies.length === 0) {
    return (
      <Card className="flex items-center gap-3">
        <StatusDot tone="ok" />
        <span className="text-sm text-ink-200">当前无异常。空集合已被拦截为异常、除零边界已记录影响范围与来源行。</span>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {emptySetAnomalies.length > 0 && (
        <Card glow="alert" className="border-alert/40">
          <SectionLabel hint="旧逻辑会把空集合当正常输入通过">空集合告警</SectionLabel>
          <div className="space-y-2">
            {emptySetAnomalies.map((a) => (
              <div key={a.id} className="rounded-sm border border-alert/30 bg-alert/[0.06] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-alert" />
                    <span className="text-sm font-semibold text-ink-100">{a.title}</span>
                  </div>
                  <Tag tone="alert">空集合 ≠ 正常空输入</Tag>
                </div>
                <p className="mt-1.5 text-xs text-ink-300">{a.detail}</p>
                <div className="mt-2 text-[11px] text-muted">
                  run <span className="mono text-ink-200">{a.runId}</span> · 矩阵{' '}
                  <span className="text-ink-200">{labelFor(a.matrixId)}</span> · 来源{' '}
                  <span className="mono text-accent">{a.sourceFile}:{a.sourceLine}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {others.map((a) => {
          const meta = KIND_META[a.kind];
          return (
            <Card key={a.id} className="panel-hover">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4 text-ink-300" />
                  <span className="text-sm font-semibold text-ink-100">{a.title}</span>
                </div>
                <Tag tone={meta.tone}>{meta.label}</Tag>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-300">{a.detail}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                <span>
                  run <span className="mono text-ink-200">{a.runId?.slice(0, 16)}</span>
                </span>
                <span>矩阵 {labelFor(a.matrixId)}</span>
                {a.sourceLine && (
                  <span>
                    来源 <span className="mono text-accent">{a.sourceFile}:{a.sourceLine}</span>
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
