import { useState } from 'react';
import { GitCompare, Check, X, Lock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { ConflictType, ConflictStatus } from '@/types';

const conflictTypeLabels: Record<ConflictType, string> = {
  score_mismatch: '分数不一致',
  denominator_zero_empty: '分母为0空字符串',
  median_deviation: '中位数偏差',
  duplicate: '重复记录',
};

const statusConfig: Record<ConflictStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  confirmed: { label: '已确认', color: '#16c784', bg: 'rgba(22,199,132,0.12)' },
  rejected: { label: '已驳回', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  needs_review: { label: '待复核', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
};

const CARD_BG = '#1a1a2e';
const CARD_BORDER = '#2a2a4a';
const GREEN = '#16c784';
const RED = '#e94560';
const PURPLE = '#8b5cf6';

export default function ConflictsPage() {
  const currentBatchId = useAppStore((s) => s.currentBatchId);
  const getConflictsByBatch = useAppStore((s) => s.getConflictsByBatch);
  const getEvidencesByConflict = useAppStore((s) => s.getEvidencesByConflict);
  const resolveConflict = useAppStore((s) => s.resolveConflict);
  const logAction = useAppStore((s) => s.logAction);

  const [rejectInputs, setRejectInputs] = useState<Record<string, string>>({});
  const [expandedReject, setExpandedReject] = useState<Record<string, boolean>>({});

  if (!currentBatchId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#9ca3af' }}>
        <AlertTriangle size={20} style={{ marginRight: 8 }} />
        请先选择当前批次
      </div>
    );
  }

  const conflicts = getConflictsByBatch(currentBatchId);
  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;
  const needsReviewCount = conflicts.filter((c) => c.status === 'needs_review').length;

  function handleConfirm(conflictId: string) {
    resolveConflict(conflictId, 'confirmed', '确认冲突', 'operator');
    logAction(currentBatchId, 'resolve_conflict', 'operator', `冲突 ${conflictId} 已确认`);
  }

  function handleReject(conflictId: string) {
    const reason = rejectInputs[conflictId]?.trim();
    if (!reason) return;
    resolveConflict(conflictId, 'rejected', reason, 'operator');
    logAction(currentBatchId, 'resolve_conflict', 'operator', `冲突 ${conflictId} 已驳回：${reason}`);
    setRejectInputs((prev) => {
      const next = { ...prev };
      delete next[conflictId];
      return next;
    });
    setExpandedReject((prev) => {
      const next = { ...prev };
      delete next[conflictId];
      return next;
    });
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <GitCompare size={24} />
        冲突裁定
      </h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard label="总冲突数" value={conflicts.length} color="#60a5fa" />
        <SummaryCard label="待处理" value={pendingCount} color="#f59e0b" />
        <SummaryCard label="待复核" value={needsReviewCount} color={PURPLE} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {conflicts.map((conflict) => {
          const evidences = getEvidencesByConflict(conflict.id);
          const evidence = evidences[0];
          const isPending = conflict.status === 'pending';
          const isNeedsReview = conflict.status === 'needs_review';
          const isResolved = conflict.status === 'confirmed' || conflict.status === 'rejected';
          const showingRejectInput = expandedReject[conflict.id];

          return (
            <div
              key={conflict.id}
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      background: 'rgba(234,69,96,0.12)',
                      color: RED,
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {conflictTypeLabels[conflict.conflictType]}
                  </span>
                  <span
                    style={{
                      background: statusConfig[conflict.status].bg,
                      color: statusConfig[conflict.status].color,
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {statusConfig[conflict.status].label}
                  </span>
                </div>
                <span style={{ color: '#6b7280', fontSize: 12 }}>ID: {conflict.id}</span>
              </div>

              {evidence && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'stretch', marginBottom: 14 }}>
                  <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8, padding: 14 }}>
                    <div style={{ color: PURPLE, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>批注值</div>
                    <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6 }}>{evidence.annotationValue}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>{evidence.annotationSource}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GitCompare size={16} color="#475569" />
                  </div>
                  <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8, padding: 14 }}>
                    <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>抽样名单值</div>
                    <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6 }}>{evidence.sampleValue}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>{evidence.sampleSource}</div>
                  </div>
                </div>
              )}

              {isPending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleConfirm(conflict.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: GREEN,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={14} />
                    确认
                  </button>
                  <button
                    onClick={() => setExpandedReject((prev) => ({ ...prev, [conflict.id]: !prev[conflict.id] }))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'transparent',
                      color: RED,
                      border: `1px solid ${RED}`,
                      borderRadius: 6,
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                    驳回
                  </button>
                  {showingRejectInput && (
                    <div style={{ display: 'flex', gap: 8, flex: '1 1 300px', marginTop: 4 }}>
                      <input
                        value={rejectInputs[conflict.id] || ''}
                        onChange={(e) => setRejectInputs((prev) => ({ ...prev, [conflict.id]: e.target.value }))}
                        placeholder="请输入驳回原因（必填）"
                        style={{
                          flex: 1,
                          background: '#0f0f23',
                          border: `1px solid ${CARD_BORDER}`,
                          borderRadius: 6,
                          padding: '7px 12px',
                          color: '#e2e8f0',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => handleReject(conflict.id)}
                        disabled={!rejectInputs[conflict.id]?.trim()}
                        style={{
                          background: rejectInputs[conflict.id]?.trim() ? RED : '#374151',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '7px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: rejectInputs[conflict.id]?.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        提交
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isNeedsReview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Lock size={16} color={PURPLE} />
                  <span style={{ color: PURPLE, fontSize: 13, fontWeight: 500 }}>需复核人复核</span>
                  <button
                    disabled
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#374151',
                      color: '#6b7280',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      opacity: 0.5,
                    }}
                  >
                    <Check size={14} />
                    确认
                  </button>
                </div>
              )}

              {isResolved && (
                <div style={{ color: statusConfig[conflict.status].color, fontSize: 13 }}>
                  {conflict.status === 'confirmed' ? '已确认' : `已驳回：${conflict.resolution}`}
                  {conflict.resolvedBy && <span style={{ color: '#6b7280', marginLeft: 8 }}>操作人：{conflict.resolvedBy}</span>}
                </div>
              )}
            </div>
          );
        })}

        {conflicts.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
            当前批次无冲突记录
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        padding: '14px 20px',
        minWidth: 120,
      }}
    >
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
