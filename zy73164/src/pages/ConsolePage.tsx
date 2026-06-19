import { useMemo, useState } from 'react';
import { Play, RefreshCw, Fingerprint } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Card, SectionLabel, Button } from '@/components/primitives';
import { MatrixCells } from '@/components/MatrixGrid';
import { IdempotencyBanner } from '@/components/IdempotencyBanner';
import { ResultPanel } from '@/components/ResultPanel';
import { fingerprint, shortFingerprint } from '@/lib/fingerprint';
import { cloneMatrix } from '@/lib/matrix';
import type { DecomposeMethod, PivotStrategy, ReplayRequest } from '@/types';

const METHODS: { value: DecomposeMethod; label: string }[] = [
  { value: 'LU', label: 'LU 分解（部分主元）' },
  { value: 'QR', label: 'QR 分解（Householder）' },
  { value: 'CHOLESKY', label: 'Cholesky 分解' },
];
const PIVOTS: { value: PivotStrategy; label: string }[] = [
  { value: 'partial', label: '部分主元' },
  { value: 'none', label: '不选主元' },
];

const DEFAULT_MATRIX = [
  [4, 3, 0],
  [2, 1, 0],
  [0, 0, 1],
];

export function ConsolePage() {
  const materials = useReplayStore((s) => s.materials);
  const submitReplay = useReplayStore((s) => s.submitReplay);
  const forceRerun = useReplayStore((s) => s.forceRerun);
  const lastRunId = useReplayStore((s) => s.lastRunId);
  const lastHit = useReplayStore((s) => s.lastHit);
  const runs = useReplayStore((s) => s.runs);
  const results = useReplayStore((s) => s.results);

  const [matrixId, setMatrixId] = useState<string>('custom');
  const [matrix, setMatrix] = useState<number[][]>(() =>
    materials[0] ? cloneMatrix(materials[0].matrix) : DEFAULT_MATRIX,
  );
  const [method, setMethod] = useState<DecomposeMethod>(materials[0]?.method ?? 'LU');
  const [pivot, setPivot] = useState<PivotStrategy>('partial');
  const [tolerance, setTolerance] = useState(1e-9);

  const req: ReplayRequest = useMemo(
    () => ({ matrixId, matrix, method, pivot, tolerance }),
    [matrixId, matrix, method, pivot, tolerance],
  );
  const fpPreview = useMemo(() => fingerprint(req), [req]);
  const lastRun = lastRunId ? runs.find((r) => r.runId === lastRunId) : undefined;

  const loadPreset = (id: string) => {
    if (id === 'custom') {
      setMatrixId('custom');
      setMatrix(DEFAULT_MATRIX);
      return;
    }
    const m = materials.find((x) => x.matrixId === id);
    if (!m) return;
    setMatrixId(m.matrixId);
    setMatrix(cloneMatrix(m.matrix));
    setMethod(m.method);
  };

  const onSubmit = () => submitReplay(req);
  const onRerun = () => {
    if (lastRunId) forceRerun(req);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-4">
        <Card>
          <SectionLabel hint="选材料即载入历史矩阵、方法与现场痕迹">回放请求</SectionLabel>

          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">材料预设</label>
          <select
            value={matrixId}
            onChange={(e) => loadPreset(e.target.value)}
            className="mb-3 h-9 w-full rounded-sm border border-white/10 bg-ink-900/80 px-2 text-sm text-ink-100 outline-none focus:border-accent/60"
          >
            <option value="custom">自定义矩阵</option>
            {materials.map((m) => (
              <option key={m.matrixId} value={m.matrixId}>
                {m.label}
                {m.emptySet ? '（空集合历史答案）' : ''}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">矩阵</label>
          <MatrixCells m={matrix} onChange={setMatrix} />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">方法</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as DecomposeMethod)}
                className="h-9 w-full rounded-sm border border-white/10 bg-ink-900/80 px-2 text-sm text-ink-100 outline-none focus:border-accent/60"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">主元策略</label>
              <select
                value={pivot}
                onChange={(e) => setPivot(e.target.value as PivotStrategy)}
                className="h-9 w-full rounded-sm border border-white/10 bg-ink-900/80 px-2 text-sm text-ink-100 outline-none focus:border-accent/60"
              >
                {PIVOTS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted">容差（除零判定阈值）</label>
            <input
              type="number"
              step="any"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="mono h-9 w-full rounded-sm border border-white/10 bg-ink-900/80 px-2 text-sm text-ink-100 outline-none focus:border-accent/60"
            />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] p-2">
            <Fingerprint className="h-4 w-4 text-accent" />
            <span className="text-[11px] text-muted">请求指纹</span>
            <span className="mono ml-auto text-[11px] text-ink-200" title={fpPreview}>
              {shortFingerprint(fpPreview)}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={onSubmit} className="flex-1">
              <Play className="h-4 w-4" />
              提交回放
            </Button>
            <Button variant="subtle" onClick={onRerun} disabled={!lastRunId} title="重跑：新 run，备注随指纹保留">
              <RefreshCw className="h-4 w-4" />
              重跑一遍
            </Button>
          </div>
        </Card>

        <Card>
          <SectionLabel hint="两次相同请求 → 同一 runId，不计两份">幂等说明</SectionLabel>
          <p className="text-xs leading-relaxed text-ink-300">
            相同矩阵+方法+主元+容差的请求会生成同一指纹。重复提交命中已有 run，不新增记录；同一条人工改判只计一份。重跑会生成新 run，并随指纹保留原备注。
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        {lastRunId && lastHit !== null && (
          <IdempotencyBanner
            hit={lastHit}
            runId={lastRunId}
            createdAt={lastRun?.createdAt ?? results[lastRunId]?.createdAt}
          />
        )}
        <ResultPanel runId={lastRunId ?? ''} />
      </div>
    </div>
  );
}
