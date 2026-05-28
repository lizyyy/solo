import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { manualMatch, splitTransaction, mergeTransactions } from '../services/matchService';
import { formatAmount } from '../utils';
import type { BankTransaction, Voucher } from '../types';

export default function ManualConfirm() {
  const { state, refreshBatch } = useApp();
  const [mode, setMode] = useState<'match' | 'split' | 'merge'>('match');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [splitAmounts, setSplitAmounts] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const unmatchedTransactions = useMemo(() => {
    return state.transactions.filter((t) => !t.matched);
  }, [state.transactions]);

  const unmatchedVouchers = useMemo(() => {
    return state.vouchers.filter((v) => !v.matched);
  }, [state.vouchers]);

  const toggleTransaction = useCallback((id: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleVoucher = useCallback((id: string) => {
    setSelectedVouchers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedTransactionAmount = useMemo(() => {
    return unmatchedTransactions
      .filter((t) => selectedTransactions.has(t.id))
      .reduce((sum, t) => sum + t.debitAmount + t.creditAmount, 0);
  }, [unmatchedTransactions, selectedTransactions]);

  const selectedVoucherAmount = useMemo(() => {
    return unmatchedVouchers
      .filter((v) => selectedVouchers.has(v.id))
      .reduce((sum, v) => sum + v.debitAmount + v.creditAmount, 0);
  }, [unmatchedVouchers, selectedVouchers]);

  const handleManualMatch = useCallback(async () => {
    if (!state.currentBatchId) return;
    if (selectedTransactions.size === 0 || selectedVouchers.size === 0) return;

    setProcessing(true);
    try {
      await manualMatch(
        state.currentBatchId,
        Array.from(selectedTransactions),
        Array.from(selectedVouchers)
      );
      await refreshBatch();
      setSelectedTransactions(new Set());
      setSelectedVouchers(new Set());
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, selectedTransactions, selectedVouchers, refreshBatch]);

  const handleSplit = useCallback(async () => {
    if (!state.currentBatchId || selectedTransactions.size !== 1) return;

    setProcessing(true);
    try {
      const amounts = splitAmounts
        .split(/[,，、\s]+/)
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      if (amounts.length < 2) {
        alert('请输入至少2个金额，用逗号分隔');
        return;
      }

      const transactionId = Array.from(selectedTransactions)[0];
      await splitTransaction(transactionId, amounts, state.currentBatchId);
      await refreshBatch();
      setSelectedTransactions(new Set());
      setSplitAmounts('');
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, selectedTransactions, splitAmounts, refreshBatch]);

  const handleMerge = useCallback(async () => {
    if (!state.currentBatchId || selectedTransactions.size < 2) return;

    setProcessing(true);
    try {
      await mergeTransactions(Array.from(selectedTransactions), state.currentBatchId);
      await refreshBatch();
      setSelectedTransactions(new Set());
    } finally {
      setProcessing(false);
    }
  }, [state.currentBatchId, selectedTransactions, refreshBatch]);

  return (
    <div className="manual-confirm">
      <div className="panel-header">
        <h3>人工处理</h3>
        <div className="mode-tabs">
          <button
            className={`tab-btn ${mode === 'match' ? 'active' : ''}`}
            onClick={() => setMode('match')}
          >
            手动匹配
          </button>
          <button
            className={`tab-btn ${mode === 'split' ? 'active' : ''}`}
            onClick={() => setMode('split')}
          >
            拆分流水
          </button>
          <button
            className={`tab-btn ${mode === 'merge' ? 'active' : ''}`}
            onClick={() => setMode('merge')}
          >
            合并流水
          </button>
        </div>
      </div>

      {mode === 'match' && (
        <div className="match-mode">
          <div className="selection-summary">
            <div className="selection-info">
              <span>已选流水：{selectedTransactions.size} 条</span>
              <span className="amount-highlight">{formatAmount(selectedTransactionAmount)}</span>
            </div>
            <div className="selection-info">
              <span>已选凭证：{selectedVouchers.size} 条</span>
              <span className="amount-highlight">{formatAmount(selectedVoucherAmount)}</span>
            </div>
            <button
              className="btn-primary"
              onClick={handleManualMatch}
              disabled={selectedTransactions.size === 0 || selectedVouchers.size === 0 || processing}
            >
              确认匹配
            </button>
          </div>

          <div className="dual-panel">
            <div className="panel transactions-panel">
              <h4>未匹配流水 ({unmatchedTransactions.length})</h4>
              <div className="list-container">
                {unmatchedTransactions.map((t: BankTransaction) => (
                  <div
                    key={t.id}
                    className={`list-item ${selectedTransactions.has(t.id) ? 'selected' : ''}`}
                    onClick={() => toggleTransaction(t.id)}
                  >
                    <div className="item-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(t.id)}
                        onChange={() => {}}
                      />
                    </div>
                    <div className="item-content">
                      <div className="item-header">
                        <span className="item-no">{t.transactionNo}</span>
                        <span className="item-amount">{formatAmount(t.debitAmount || t.creditAmount)}</span>
                      </div>
                      <div className="item-summary">{t.summary}</div>
                      <div className="item-meta">
                        <span>{t.transactionDate}</span>
                        <span>{t.counterparty}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel vouchers-panel">
              <h4>未匹配凭证 ({unmatchedVouchers.length})</h4>
              <div className="list-container">
                {unmatchedVouchers.map((v: Voucher) => (
                  <div
                    key={v.id}
                    className={`list-item ${selectedVouchers.has(v.id) ? 'selected' : ''}`}
                    onClick={() => toggleVoucher(v.id)}
                  >
                    <div className="item-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedVouchers.has(v.id)}
                        onChange={() => {}}
                      />
                    </div>
                    <div className="item-content">
                      <div className="item-header">
                        <span className="item-no">{v.voucherNo}</span>
                        <span className="item-amount">{formatAmount(v.debitAmount || v.creditAmount)}</span>
                      </div>
                      <div className="item-summary">{v.summary}</div>
                      <div className="item-meta">
                        <span>{v.voucherDate}</span>
                        <span>{v.accountName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'split' && (
        <div className="split-mode">
          <div className="split-config">
            <h4>选择一条流水进行拆分</h4>
            <div className="split-input">
              <label>拆分金额（用逗号分隔，总和需等于原金额）：</label>
              <input
                type="text"
                placeholder="例如：1000, 2000, 3000"
                value={splitAmounts}
                onChange={(e) => setSplitAmounts(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleSplit}
              disabled={selectedTransactions.size !== 1 || !splitAmounts || processing}
            >
              执行拆分
            </button>
          </div>

          <div className="transactions-list">
            <h4>可选流水</h4>
            {unmatchedTransactions.map((t: BankTransaction) => (
              <div
                key={t.id}
                className={`list-item ${selectedTransactions.has(t.id) ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTransactions(new Set([t.id]));
                }}
              >
                <div className="item-checkbox">
                  <input
                    type="radio"
                    checked={selectedTransactions.has(t.id)}
                    onChange={() => {}}
                  />
                </div>
                <div className="item-content">
                  <div className="item-header">
                    <span className="item-no">{t.transactionNo}</span>
                    <span className="item-amount">{formatAmount(t.debitAmount || t.creditAmount)}</span>
                  </div>
                  <div className="item-summary">{t.summary}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'merge' && (
        <div className="merge-mode">
          <div className="merge-config">
            <h4>选择多条流水进行合并</h4>
            <p>已选择 {selectedTransactions.size} 条流水</p>
            <button
              className="btn-primary"
              onClick={handleMerge}
              disabled={selectedTransactions.size < 2 || processing}
            >
              执行合并
            </button>
          </div>

          <div className="transactions-list">
            <h4>可选流水</h4>
            {unmatchedTransactions.map((t: BankTransaction) => (
              <div
                key={t.id}
                className={`list-item ${selectedTransactions.has(t.id) ? 'selected' : ''}`}
                onClick={() => toggleTransaction(t.id)}
              >
                <div className="item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.has(t.id)}
                    onChange={() => {}}
                  />
                </div>
                <div className="item-content">
                  <div className="item-header">
                    <span className="item-no">{t.transactionNo}</span>
                    <span className="item-amount">{formatAmount(t.debitAmount || t.creditAmount)}</span>
                  </div>
                  <div className="item-summary">{t.summary}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
