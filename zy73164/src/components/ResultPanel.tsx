import { Cpu, Sliders, Download, AlertTriangle } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Card, SectionLabel, Tag, Stat, statusMeta, emptyMeta, Button } from './primitives';
import { MatrixGrid } from './MatrixGrid';
import { BoundaryCard } from './BoundaryCard';
import { OverridePanel } from './OverridePanel';
import { SupplementaryNotePanel } from './SupplementaryNotePanel';
import { TraceabilityChain } from './TraceabilityChain';
import { FingerprintTag } from './FingerprintTag';
import type { Factors } from '@/types';

const METHOD_LABEL: Record<string, string> = {
  LU: 'LU 分解（部分主元）',
  QR: 'QR 分解（Householder）',
  CHOLESKY: 'Cholesky 分解',
};

function FactorBlock({ title, matrix }: { title: string; matrix: number[][] | null }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{title}</div>
      {matrix && matrix.length > 0 ? (
        <MatrixGrid m={matrix} className="w-fit" />
      ) : (
        <div className="rounded-sm border border-dashed border-white/10 p-3 text-xs text-muted">∅ 空矩阵</div>
      )}
    </div>
  );
}

export function ResultPanel({ runId }: { runId: string }) {
  const result = useReplayStore((s) => s.results[runId]);
  const run = useReplayStore((s) => s.runs.find((r) => r.runId === runId));
  const exportCsv = useReplayStore((s) => s.exportCsv);

  if (!result || !run) {
    return (
      <Card className="flex h-full items-center justify-center p-8">
        <span className="text-sm text-muted">提交一次回放以查看结果。</span>
      </Card>
    );
  }

  const meta = statusMeta(run.status);
  const em = emptyMeta(result.emptySetFlag);
  const factors = result.factors as Factors;
  const showEmptyAlert = result.emptySetFlag === 'EMPTY_ANOMALY';
  const glowTone = meta.tone === 'accent' || meta.tone === 'alert' ? meta.tone : undefined;

  return (
    <div className="space-y-4">
      <Card glow={glowTone}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tag tone={meta.tone}>{meta.label}</Tag>
            <div className="flex items-center gap-2 text-sm text-ink-200">
              <Cpu className="h-4 w-4 text-muted" />
              {METHOD_LABEL[result.method] ?? result.method.toUpperCase()}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Sliders className="h-3 w-3" />
              容差 {result.tolerance}
            </div>
          </div>
          <FingerprintTag fp={result.fingerprint} full />
        </div>
      </Card>

      {showEmptyAlert && (
        <Card glow="alert" className="flex items-start gap-3 border-alert/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alert" />
          <div>
            <div className="text-sm font-semibold text-ink-100">空集合历史答案 · 已拦截为异常</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              旧逻辑会把空集合当正常输入通过；当前已识别为异常并标记待改判。请在「人工改判」填写理由，或在「材料与历史」补历史答案。
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="重建误差"
          value={result.reconError.toExponential(2)}
          tone={result.verified ? 'ok' : 'alert'}
        />
        <Stat label="空集合标记" value={em.label} tone={em.tone} />
        <Stat label="边界事件" value={String(result.boundaries.length)} tone={result.boundaries.length ? 'warn' : 'ok'} />
        <Stat label="历史比对" value={result.verified ? '一致' : '不一致'} tone={result.verified ? 'ok' : 'alert'} />
      </div>

      {(factors.L || factors.U || factors.Q || factors.R) && (
        <Card>
          <SectionLabel hint="可点击来源行定位到 decompose.ts">分解因子</SectionLabel>
          <div className="flex flex-wrap gap-6">
            {factors.L && <FactorBlock title="L" matrix={factors.L} />}
            {factors.U && <FactorBlock title="U" matrix={factors.U} />}
            {factors.Q && <FactorBlock title="Q (正交)" matrix={factors.Q} />}
            {factors.R && <FactorBlock title="R (上三角)" matrix={factors.R} />}
          </div>
          {factors.P && factors.P.length > 0 && (
            <div className="mt-4 text-[11px] text-muted">
              P (主元置换){' '}
              <span className="mono ml-2 text-ink-200">{factors.P.map((p) => p + 1).join(' → ')}</span>
            </div>
          )}
        </Card>
      )}

      {result.boundaries.length > 0 && (
        <Card>
          <SectionLabel hint="除零 / 近零边界，含影响范围与来源行">边界事件</SectionLabel>
          <div className="space-y-3">
            {result.boundaries.map((b) => (
              <BoundaryCard key={b.id} b={b} />
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <OverridePanel runId={runId} />
        <SupplementaryNotePanel runId={runId} />
      </div>

      <TraceabilityChain runId={runId} />

      <div className="flex justify-end">
        <Button variant="subtle" onClick={() => exportCsv(runId)}>
          <Download className="h-4 w-4" />
          导出 CSV 明细（含边界 / 改判 / 后补说明）
        </Button>
      </div>
    </div>
  );
}
