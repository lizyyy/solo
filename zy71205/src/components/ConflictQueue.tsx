import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  confirmMatch,
  rejectMatch,
  batchConfirm,
  batchReject,
} from '../services/confirmationService';
import {
  formatAmount,
  formatDateTime,
  getConflictTypeLabel,
} from '../utils';
import type { MatchRecord } from '../types';

export default function ConflictQueue() {
  const { state, refreshBatch } = useApp();
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [comment, setComment] = useState('');

  const pendingMatches = useMemo(() => {
    return state.matchRecords.filter(
      (m) => m.status === 'pending' || m.conflicts.some((c) => !c.resolved)
    );
  }, [state.matchRecords]);

  const getMatchTransactions = (match: MatchRecord) => {
    return state.transactions.filter((t) => match.transactionIds.includes(t.id));
  };

  const getMatchVouchers = (match: MatchRecord) => {
    return state.vouchers.filter((v) => match.voucherIds.includes(v.id));
  };

  const toggleSelect = useCallback((matchId: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedMatches.size === pendingMatches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(pendingMatches.map((m) => m.id)));
    }
  }, [selectedMatches.size, pendingMatches]);

  const handleConfirm = useCallback(async (matchId: string) => {
    if (!state.currentBatchId) return;
    setProcessing(true);
    try {
      await confirmMatch(matchId, state.currentBatchId, comment);
      await refreshBatch();
      setSelectedMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, comment, refreshBatch]);

  const handleReject = useCallback(async (matchId: string) => {
    if (!state.currentBatchId) return;
    setProcessing(true);
    try {
      await rejectMatch(matchId, state.currentBatchId, comment);
      await refreshBatch();
      setSelectedMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, comment, refreshBatch]);

  const handleBatchConfirm = useCallback(async () => {
    if (!state.currentBatchId || selectedMatches.size === 0) return;
    setProcessing(true);
    try {
      await batchConfirm(Array.from(selectedMatches), state.currentBatchId, comment);
      await refreshBatch();
      setSelectedMatches(new Set());
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, selectedMatches, comment, refreshBatch]);

  const handleBatchReject = useCallback(async () => {
    if (!state.currentBatchId || selectedMatches.size === 0) return;
    setProcessing(true);
    try {
      await batchReject(Array.from(selectedMatches), state.currentBatchId, comment);
      await refreshBatch();
      setSelectedMatches(new Set());
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, selectedMatches, comment, refreshBatch]);

  return (
    <div className="conflict-queue">
      <div className="queue-header">
        <h3>冲突队列 / 待确认 ({pendingMatches.length})</h3>
        <div className="batch-actions">
          <input
            type="text"
            placeholder="处理备注（可选）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="comment-input"
          />
          <button
            className="btn-success"
            onClick={handleBatchConfirm}
            disabled={selectedMatches.size === 0 || processing}
          >
            批量确认 ({selectedMatches.size})
          </button>
          <button
            className="btn-danger"
            onClick={handleBatchReject}
            disabled={selectedMatches.size === 0 || processing}
          >
            批量拒绝 ({selectedMatches.size})
          </button>
        </div>
      </div>

      <div className="queue-intro">
        <p>
          <strong>说明：</strong>以下匹配存在冲突或异常，需要人工确认。
          宁可标记待确认，也不要安静通过。
        </p>
      </div>

      {pendingMatches.length === 0 ? (
        <div className="empty-state">
          <p>🎉 没有待处理的冲突！所有匹配都已确认。</p>
        </div>
      ) : (
        <div className="conflict-list">
          <div className="list-header">
            <label className="select-all">
              <input
                type="checkbox"
                checked={selectedMatches.size === pendingMatches.length && pendingMatches.length > 0}
                onChange={selectAll}
              />
              全选
            </label>
          </div>

          {pendingMatches.map((match) => {
            const transactions = getMatchTransactions(match);
            const vouchers = getMatchVouchers(match);

            return (
              <div
                key={match.id}
                className={`conflict-card ${selectedMatches.has(match.id) ? 'selected' : ''}`}
              >
                <div className="card-header">
                  <label className="card-select">
                    <input
                      type="checkbox"
                      checked={selectedMatches.has(match.id)}
                      onChange={() => toggleSelect(match.id)}
                    />
                  </label>
                  <div className="card-title">
                    <span className="match-score">匹配分: {match.matchScore}</span>
                    <span className="match-time">{formatDateTime(match.createdAt)}</span>
                  </div>
                  <div className="card-actions">
                    <button
                      className="btn-sm btn-success"
                      onClick={() => handleConfirm(match.id)}
                      disabled={processing}
                    >
                      确认
                    </button>
                    <button
                      className="btn-sm btn-danger"
                      onClick={() => handleReject(match.id)}
                      disabled={processing}
                    >
                      拒绝
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  <div className="side-by-side">
                    <div className="side-panel bank-side">
                      <h5>银行流水</h5>
                      {transactions.map((t) => (
                        <div key={t.id} className="record-item">
                          <div className="record-header">
                            <span className="record-no">{t.transactionNo}</span>
                            <span className="record-amount">{formatAmount(t.debitAmount || t.creditAmount)}</span>
                          </div>
                          <div className="record-summary">{t.summary}</div>
                          <div className="record-meta">
                            <span>对方: {t.counterparty}</span>
                            {t.isRedFlush && <span className="red-flush-badge">红冲</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="vs-divider">VS</div>

                    <div className="side-panel voucher-side">
                      <h5>凭证</h5>
                      {vouchers.map((v) => (
                        <div key={v.id} className="record-item">
                          <div className="record-header">
                            <span className="record-no">{v.voucherNo}</span>
                            <span className="record-amount">{formatAmount(v.debitAmount || v.creditAmount)}</span>
                          </div>
                          <div className="record-summary">{v.summary}</div>
                          <div className="record-meta">
                            <span>科目: {v.accountName}</span>
                            {v.isRedFlush && <span className="red-flush-badge">红冲</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {match.conflicts.length > 0 && (
                    <div className="conflict-warnings">
                      <h6>⚠️ 冲突警告：</h6>
                      {match.conflicts.map((c, i) => (
                        <div key={i} className={`warning-item warning-${c.severity}`}>
                          <span className="warning-type">[{getConflictTypeLabel(c.type)}]</span>
                          <span className="warning-desc">{c.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {match.amountDifference > 0 && (
                    <div className="amount-diff">
                      <strong>金额差额：</strong>
                      <span className="diff-amount">{formatAmount(match.amountDifference)}</span>
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
