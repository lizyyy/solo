import { useState } from 'react';
import { Boxes, FileText, Layers } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Card, SectionLabel, Tag } from '@/components/primitives';
import { MatrixGrid } from '@/components/MatrixGrid';
import { TraceChips } from '@/components/TraceChips';
import { RunHistoryTable } from '@/components/RunHistoryTable';
import { OverridePanel } from '@/components/OverridePanel';
import { SupplementaryNotePanel } from '@/components/SupplementaryNotePanel';
import { TraceabilityChain } from '@/components/TraceabilityChain';

const METHOD_LABEL: Record<string, string> = {
  LU: 'LU',
  QR: 'QR',
  CHOLESKY: 'CHOLESKY',
};

export function MaterialsPage() {
  const materials = useReplayStore((s) => s.materials);
  const lastRunId = useReplayStore((s) => s.lastRunId);
  const [selectedRunId, setSelectedRunId] = useState<string>(lastRunId ?? '');

  const runId = selectedRunId || lastRunId || '';

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel hint="历史答案里留了现场痕迹，可区分空集合异常与正常空输入">材料库</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((m) => (
            <Card key={m.matrixId} className="panel-hover">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold text-ink-100">{m.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Tag tone="neutral">{METHOD_LABEL[m.method] ?? m.method}</Tag>
                  {m.emptySet ? (
                    <Tag tone="alert">空集合</Tag>
                  ) : (
                    <Tag tone="ok">有答案</Tag>
                  )}
                </div>
              </div>
              <MatrixGrid m={m.matrix} className="mb-3" />
              <div className="mb-2 text-[11px] text-muted">现场痕迹</div>
              <TraceChips chips={m.traces} />
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                <FileText className="h-3 w-3" />
                来源行 <span className="mono text-accent">src/lib/decompose.ts:{m.sourceLine}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel hint="备注可就地编辑；重跑后随指纹保留不断线">回放记录</SectionLabel>
        <Card className="p-0">
          <RunHistoryTable onSelect={setSelectedRunId} />
        </Card>
      </div>

      {runId ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Layers className="h-3.5 w-3.5" />
            选中 run <span className="mono text-ink-200">{runId}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OverridePanel runId={runId} />
            <SupplementaryNotePanel runId={runId} />
          </div>
          <TraceabilityChain runId={runId} />
        </div>
      ) : (
        <Card className="flex items-center justify-center p-6 text-sm text-muted">
          暂无回放记录。到「回放控制台」提交一次以生成材料。
        </Card>
      )}
    </div>
  );
}
