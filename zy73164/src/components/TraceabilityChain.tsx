import { Fingerprint, FileText, MapPin, Crosshair, Download } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Card, SectionLabel } from './primitives';
import { FingerprintTag } from './FingerprintTag';
import { TraceChips } from './TraceChips';

export function TraceabilityChain({ runId }: { runId: string }) {
  const result = useReplayStore((s) => s.results[runId]);
  const run = useReplayStore((s) => s.runs.find((r) => r.runId === runId));
  const materials = useReplayStore((s) => s.materials);
  const exportCsv = useReplayStore((s) => s.exportCsv);
  if (!result || !run) return null;

  const historical = materials.find((m) => m.matrixId === run.matrixId);
  const boundaryLines = Array.from(new Set(result.boundaries.map((b) => `${b.sourceFile}:${b.sourceLine}`)));
  const allLines = Array.from(
    new Set([...result.sourceLines.map((l) => `src/lib/decompose.ts:${l}`), ...boundaryLines]),
  );

  const steps = [
    {
      icon: Fingerprint,
      label: '请求指纹',
      node: <FingerprintTag fp={result.fingerprint} full />,
    },
    {
      icon: FileText,
      label: '历史答案',
      node: (
        <div className="text-[11px] leading-relaxed text-ink-200">
          {historical?.label ?? '—'}
          <div className="text-muted">
            {result.emptySetFlag === 'EMPTY_ANOMALY'
              ? '空集合（已拦截为异常）'
              : result.emptySetFlag === 'NORMAL_EMPTY'
                ? '正常空输入'
                : '有历史答案可比对'}
          </div>
        </div>
      ),
    },
    {
      icon: Crosshair,
      label: '现场痕迹',
      node: historical ? <TraceChips chips={historical.traces} /> : <span className="text-muted">—</span>,
    },
    {
      icon: MapPin,
      label: '来源行',
      node: (
        <div className="flex flex-wrap gap-1">
          {allLines.length === 0 ? (
            <span className="text-muted">无边界</span>
          ) : (
            allLines.map((l) => (
              <span
                key={l}
                className="mono rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent"
              >
                {l}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      icon: Download,
      label: 'CSV 明细',
      node: (
        <button
          type="button"
          onClick={() => exportCsv(runId)}
          className="mono rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-ink-200 hover:border-accent/40 hover:text-accent"
        >
          {run.csvToken}
        </button>
      ),
    },
  ];

  return (
    <Card>
      <SectionLabel hint="数字从哪来：指纹 → 历史答案 → 现场痕迹 → 来源行 → CSV">追溯线索链</SectionLabel>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-accent">
                <s.icon className="h-3.5 w-3.5" />
              </div>
              {i < steps.length - 1 && <div className="mt-1 h-4 w-px bg-white/10" />}
            </div>
            <div className="flex-1 pb-1">
              <div className="text-[11px] uppercase tracking-wider text-muted">{s.label}</div>
              <div className="mt-1">{s.node}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
