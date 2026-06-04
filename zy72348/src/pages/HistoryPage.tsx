import { useState } from 'react';
import { format } from 'date-fns';
import {
  History,
  Upload,
  CheckCircle2,
  AlertTriangle,
  GitCompare,
  Workflow,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

type ActionType = 'import' | 'check' | 'conflict' | 'resolve' | 'workflow';

function getActionType(action: string): ActionType {
  const lower = action.toLowerCase();
  if (lower.includes('import')) return 'import';
  if (lower.includes('check')) return 'check';
  if (lower.includes('conflict')) return 'conflict';
  if (lower.includes('resolv')) return 'resolve';
  if (lower.includes('workflow') || lower.includes('step')) return 'workflow';
  return 'import';
}

const ACTION_ICON: Record<ActionType, typeof Upload> = {
  import: Upload,
  check: CheckCircle2,
  conflict: AlertTriangle,
  resolve: GitCompare,
  workflow: Workflow,
};

const ACTION_COLOR: Record<ActionType, string> = {
  import: '#6366f1',
  check: '#22c55e',
  conflict: '#f59e0b',
  resolve: '#3b82f6',
  workflow: '#a855f7',
};

function ExpandedImport({ batchId }: { batchId: string }) {
  const annotations = useAppStore((s) => s.getAnnotationsByBatch(batchId));
  if (annotations.length === 0) return <div style={{ color: '#888' }}>暂无导入批注数据</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ color: '#aaa', borderBottom: '1px solid #2a2a4a' }}>
          <th style={{ padding: '4px 8px', textAlign: 'left' }}>科目</th>
          <th style={{ padding: '4px 8px', textAlign: 'left' }}>教师</th>
          <th style={{ padding: '4px 8px', textAlign: 'left' }}>分数</th>
          <th style={{ padding: '4px 8px', textAlign: 'left' }}>分母</th>
          <th style={{ padding: '4px 8px', textAlign: 'left' }}>来源</th>
        </tr>
      </thead>
      <tbody>
        {annotations.map((a) => (
          <tr key={a.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
            <td style={{ padding: '4px 8px' }}>{a.subject}</td>
            <td style={{ padding: '4px 8px' }}>{a.teacherId}</td>
            <td style={{ padding: '4px 8px' }}>{a.score}</td>
            <td style={{ padding: '4px 8px' }}>{a.denominator || a.rawDenominator}</td>
            <td style={{ padding: '4px 8px' }}>{a.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpandedCheck({ batchId }: { batchId: string }) {
  const checks = useAppStore((s) => s.getChecksByBatch(batchId));
  if (checks.length === 0) return <div style={{ color: '#888' }}>暂无自检结果</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {checks.map((c) => (
        <div
          key={c.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: '#12121f',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <span style={{ color: c.passed ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
            {c.passed ? '通过' : '未通过'}
          </span>
          <span style={{ color: '#aaa' }}>{c.checkType}</span>
          <span style={{ color: '#ddd' }}>{c.detail}</span>
        </div>
      ))}
    </div>
  );
}

function ExpandedConflict({ batchId }: { batchId: string }) {
  const conflicts = useAppStore((s) => s.getConflictsByBatch(batchId));
  const getEvidencesByConflict = useAppStore((s) => s.getEvidencesByConflict);
  if (conflicts.length === 0) return <div style={{ color: '#888' }}>暂无冲突记录</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {conflicts.map((c) => {
        const evds = getEvidencesByConflict(c.id);
        return (
          <div
            key={c.id}
            style={{
              padding: '8px 12px',
              background: '#12121f',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>{c.conflictType}</span>
              <span style={{ color: '#aaa' }}>状态: {c.status}</span>
            </div>
            {evds.map((e) => (
              <div key={e.id} style={{ paddingLeft: 12, borderLeft: '2px solid #2a2a4a', marginTop: 4 }}>
                <div style={{ color: '#ddd' }}>批注值: {e.annotationValue}</div>
                <div style={{ color: '#ddd' }}>抽样值: {e.sampleValue}</div>
                <div style={{ color: '#888', fontSize: 12 }}>
                  {e.annotationSource} vs {e.sampleSource}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ExpandedResolve({ batchId }: { batchId: string }) {
  const conflicts = useAppStore((s) => s.getConflictsByBatch(batchId));
  const resolved = conflicts.filter(
    (c) => c.status === 'confirmed' || c.status === 'rejected',
  );
  if (resolved.length === 0) return <div style={{ color: '#888' }}>暂无已解决的冲突</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {resolved.map((c) => (
        <div
          key={c.id}
          style={{
            padding: '8px 12px',
            background: '#12121f',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{c.conflictType}</span>
            <span style={{ color: '#aaa' }}>结果: {c.status}</span>
          </div>
          <div style={{ color: '#ddd' }}>解决方案: {c.resolution || '—'}</div>
          <div style={{ color: '#888', fontSize: 12 }}>
            处理人: {c.resolvedBy || '—'} | 时间: {c.resolvedAt ? format(new Date(c.resolvedAt), 'yyyy-MM-dd HH:mm:ss') : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpandedWorkflow({ batchId }: { batchId: string }) {
  const getWorkflowByBatch = useAppStore((s) => s.getWorkflowByBatch);
  const steps = getWorkflowByBatch(batchId);
  if (steps.length === 0) return <div style={{ color: '#888' }}>暂无工作流步骤</div>;
  const statusLabel: Record<string, string> = {
    pending: '待开始',
    in_progress: '进行中',
    blocked: '已阻塞',
    completed: '已完成',
  };
  const statusColor: Record<string, string> = {
    pending: '#888',
    in_progress: '#6366f1',
    blocked: '#ef4444',
    completed: '#22c55e',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((st) => (
        <div
          key={st.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            background: '#12121f',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <span style={{ width: 20, textAlign: 'center', color: '#666', fontWeight: 600 }}>
            {st.stepIndex}
          </span>
          <span style={{ color: '#ddd', flex: 1 }}>{st.stepName}</span>
          <span style={{ color: statusColor[st.status] || '#888', fontWeight: 600 }}>
            {statusLabel[st.status] || st.status}
          </span>
          {st.operator && <span style={{ color: '#888', fontSize: 12 }}>{st.operator}</span>}
        </div>
      ))}
    </div>
  );
}

function ExpandedContent({ actionType, batchId }: { actionType: ActionType; batchId: string }) {
  switch (actionType) {
    case 'import':
      return <ExpandedImport batchId={batchId} />;
    case 'check':
      return <ExpandedCheck batchId={batchId} />;
    case 'conflict':
      return <ExpandedConflict batchId={batchId} />;
    case 'resolve':
      return <ExpandedResolve batchId={batchId} />;
    case 'workflow':
      return <ExpandedWorkflow batchId={batchId} />;
  }
}

export default function HistoryPage() {
  const batches = useAppStore((s) => s.batches);
  const currentBatchId = useAppStore((s) => s.currentBatchId);
  const setCurrentBatch = useAppStore((s) => s.setCurrentBatch);
  const getLogsByBatch = useAppStore((s) => s.getLogsByBatch);
  const getAnnotationsByBatch = useAppStore((s) => s.getAnnotationsByBatch);
  const getSamplesByBatch = useAppStore((s) => s.getSamplesByBatch);
  const getConflictsByBatch = useAppStore((s) => s.getConflictsByBatch);
  const getChecksByBatch = useAppStore((s) => s.getChecksByBatch);
  const getAlertsByBatch = useAppStore((s) => s.getAlertsByBatch);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeBatchId = currentBatchId || (batches.length > 0 ? batches[0].id : null);
  const logs = activeBatchId ? getLogsByBatch(activeBatchId) : [];

  function handleExport() {
    if (!activeBatchId) return;
    const batch = batches.find((b) => b.id === activeBatchId);
    const data = {
      batch,
      annotations: getAnnotationsByBatch(activeBatchId),
      samples: getSamplesByBatch(activeBatchId),
      conflicts: getConflictsByBatch(activeBatchId),
      checks: getChecksByBatch(activeBatchId),
      alerts: getAlertsByBatch(activeBatchId),
      logs: getLogsByBatch(activeBatchId),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${activeBatchId}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px', color: '#e0e0e0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={24} style={{ color: '#6366f1' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>历史记录</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {batches.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: '#1a1a2e',
                  border: '1px solid #2a2a4a',
                  borderRadius: 6,
                  color: '#e0e0e0',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {activeBatchId
                  ? `批次: ${batches.find((b) => b.id === activeBatchId)?.operator ?? activeBatchId.slice(0, 8)}`
                  : '选择批次'}
                <ChevronDown size={14} />
              </button>
              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: '#1a1a2e',
                    border: '1px solid #2a2a4a',
                    borderRadius: 6,
                    minWidth: 180,
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {batches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setCurrentBatch(b.id);
                        setDropdownOpen(false);
                        setExpandedId(null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        background: b.id === activeBatchId ? '#2a2a4a' : 'transparent',
                        border: 'none',
                        color: '#e0e0e0',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {b.operator} — {b.materialType} — {format(new Date(b.importTime), 'MM-dd HH:mm')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={!activeBatchId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: '#1a1a2e',
              border: '1px solid #2a2a4a',
              borderRadius: 6,
              color: activeBatchId ? '#e0e0e0' : '#555',
              cursor: activeBatchId ? 'pointer' : 'not-allowed',
              fontSize: 13,
            }}
          >
            <Download size={14} />
            导出
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            color: '#666',
            background: '#1a1a2e',
            borderRadius: 8,
            border: '1px solid #2a2a4a',
          }}
        >
          暂无审计日志
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div
            style={{
              position: 'absolute',
              left: 13,
              top: 8,
              bottom: 8,
              width: 2,
              background: '#2a2a4a',
            }}
          />

          {logs.map((log) => {
            const actionType = getActionType(log.action);
            const Icon = ACTION_ICON[actionType];
            const color = ACTION_COLOR[actionType];
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} style={{ position: 'relative', marginBottom: 2 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: -21,
                    top: 14,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#1a1a2e',
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={12} style={{ color }} />
                </div>

                <div
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  style={{
                    background: '#1a1a2e',
                    border: '1px solid #2a2a4a',
                    borderLeft: isExpanded ? '3px solid #f97316' : `3px solid ${color}`,
                    borderRadius: 6,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    marginLeft: 8,
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e0' }}>{log.action}</span>
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
                      {log.actor}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#888',
                      marginTop: 2,
                      paddingLeft: 22,
                    }}
                  >
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </div>
                  <div style={{ fontSize: 13, color: '#bbb', marginTop: 4, paddingLeft: 22 }}>
                    {log.detail}
                  </div>

                  {isExpanded && activeBatchId && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingLeft: 22,
                        borderTop: '1px solid #2a2a4a',
                        paddingTop: 10,
                      }}
                    >
                      <ExpandedContent actionType={actionType} batchId={activeBatchId} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
