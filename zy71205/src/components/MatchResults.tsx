import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatAmount,
  formatDateTime,
  getMatchStatusLabel,
  getConflictTypeLabel,
} from '../utils';
import type { MatchRecord } from '../types';

export default function MatchResults() {
  const { state, runMatching } = useApp();
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMatches = useMemo(() => {
    return state.matchRecords.filter((match) => {
      if (statusFilter !== 'all' && match.status !== statusFilter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const transactions = state.transactions.filter((t) =>
          match.transactionIds.includes(t.id)
        );
        const vouchers = state.vouchers.filter((v) =>
          match.voucherIds.includes(v.id)
        );
        
        const text = [
          ...transactions.map((t) => t.summary + t.transactionNo),
          ...vouchers.map((v) => v.summary + v.voucherNo),
        ].join(' ').toLowerCase();
        
        if (!text.includes(query)) return false;
      }
      
      return true;
    });
  }, [state.matchRecords, state.transactions, state.vouchers, statusFilter, searchQuery]);

  const statistics = useMemo(() => {
    const total = state.matchRecords.length;
    const matched = state.matchRecords.filter((m) => m.status === 'matched').length;
    const pending = state.matchRecords.filter((m) => m.status === 'pending').length;
    const confirmed = state.matchRecords.filter((m) => m.status === 'confirmed').length;
    const withConflicts = state.matchRecords.filter((m) => m.conflicts.length > 0).length;
    
    return { total, matched, pending, confirmed, withConflicts };
  }, [state.matchRecords]);

  const getMatchTransactions = (match: MatchRecord) => {
    return state.transactions.filter((t) => match.transactionIds.includes(t.id));
  };

  const getMatchVouchers = (match: MatchRecord) => {
    return state.vouchers.filter((v) => match.voucherIds.includes(v.id));
  };

  return (
    <div className="match-results">
      <div className="results-header">
        <h3>匹配结果</h3>
        <button
          className="btn-primary"
          onClick={runMatching}
          disabled={!state.currentBatchId || state.loading}
        >
          执行匹配
        </button>
      </div>

      <div className="statistics-cards">
        <div className="stat-card">
          <span className="stat-value">{statistics.total}</span>
          <span className="stat-label">总匹配数</span>
        </div>
        <div className="stat-card stat-success">
          <span className="stat-value">{statistics.matched}</span>
          <span className="stat-label">已匹配</span>
        </div>
        <div className="stat-card stat-warning">
          <span className="stat-value">{statistics.pending}</span>
          <span className="stat-label">待确认</span>
        </div>
        <div className="stat-card stat-info">
          <span className="stat-value">{statistics.confirmed}</span>
          <span className="stat-label">已确认</span>
        </div>
        <div className="stat-card stat-danger">
          <span className="stat-value">{statistics.withConflicts}</span>
          <span className="stat-label">有冲突</span>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>状态筛选：</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="matched">已匹配</option>
            <option value="pending">待确认</option>
            <option value="confirmed">已确认</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
        <div className="filter-group">
          <label>搜索：</label>
          <input
            type="text"
            placeholder="搜索摘要、流水号、凭证号..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="results-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>状态</th>
              <th>匹配分数</th>
              <th>流水摘要</th>
              <th>凭证摘要</th>
              <th>流水金额</th>
              <th>凭证金额</th>
              <th>差额</th>
              <th>冲突</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.map((match) => {
              const transactions = getMatchTransactions(match);
              const vouchers = getMatchVouchers(match);
              const hasConflicts = match.conflicts.length > 0;
              
              return (
                <tr
                  key={match.id}
                  className={`
                    ${match.status === 'pending' ? 'row-pending' : ''}
                    ${match.status === 'confirmed' ? 'row-confirmed' : ''}
                    ${hasConflicts ? 'row-conflict' : ''}
                  `}
                >
                  <td>
                    <span className={`status-badge status-${match.status}`}>
                      {getMatchStatusLabel(match.status)}
                    </span>
                  </td>
                  <td>
                    <span className={`score-badge ${match.matchScore >= 80 ? 'score-high' : match.matchScore >= 60 ? 'score-medium' : 'score-low'}`}>
                      {match.matchScore}
                    </span>
                  </td>
                  <td className="cell-truncate" title={transactions.map((t) => t.summary).join('; ')}>
                    {transactions.map((t) => t.summary).join('; ')}
                  </td>
                  <td className="cell-truncate" title={vouchers.map((v) => v.summary).join('; ')}>
                    {vouchers.map((v) => v.summary).join('; ')}
                  </td>
                  <td>{formatAmount(match.totalDebitAmount || match.totalCreditAmount)}</td>
                  <td>{formatAmount(vouchers.reduce((sum, v) => sum + v.debitAmount + v.creditAmount, 0))}</td>
                  <td className={match.amountDifference > 0 ? 'text-danger' : ''}>
                    {match.amountDifference > 0 ? formatAmount(match.amountDifference) : '-'}
                  </td>
                  <td>
                    {hasConflicts ? (
                      <span className="conflict-indicator" title={match.conflicts.map((c) => c.description).join('\n')}>
                        {match.conflicts.length} 个
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-sm btn-secondary"
                      onClick={() => setSelectedMatch(match)}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredMatches.length === 0 && (
          <div className="empty-state">
            <p>暂无匹配记录，请先导入数据并执行匹配</p>
          </div>
        )}
      </div>

      {selectedMatch && (
        <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>匹配详情</h4>
              <button className="modal-close" onClick={() => setSelectedMatch(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h5>匹配信息</h5>
                <div className="detail-grid">
                  <div>
                    <label>匹配状态</label>
                    <span>{getMatchStatusLabel(selectedMatch.status)}</span>
                  </div>
                  <div>
                    <label>匹配分数</label>
                    <span>{selectedMatch.matchScore}</span>
                  </div>
                  <div>
                    <label>匹配方式</label>
                    <span>{selectedMatch.matchMethod === 'auto' ? '自动匹配' : '手动匹配'}</span>
                  </div>
                  <div>
                    <label>匹配时间</label>
                    <span>{formatDateTime(selectedMatch.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h5>银行流水 ({getMatchTransactions(selectedMatch).length} 条)</h5>
                <table className="data-table-sm">
                  <thead>
                    <tr>
                      <th>流水号</th>
                      <th>摘要</th>
                      <th>金额</th>
                      <th>对方户名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getMatchTransactions(selectedMatch).map((t) => (
                      <tr key={t.id}>
                        <td>{t.transactionNo}</td>
                        <td>{t.summary}</td>
                        <td>{formatAmount(t.debitAmount || t.creditAmount)}</td>
                        <td>{t.counterparty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="detail-section">
                <h5>凭证 ({getMatchVouchers(selectedMatch).length} 条)</h5>
                <table className="data-table-sm">
                  <thead>
                    <tr>
                      <th>凭证号</th>
                      <th>摘要</th>
                      <th>金额</th>
                      <th>科目</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getMatchVouchers(selectedMatch).map((v) => (
                      <tr key={v.id}>
                        <td>{v.voucherNo}</td>
                        <td>{v.summary}</td>
                        <td>{formatAmount(v.debitAmount || v.creditAmount)}</td>
                        <td>{v.accountName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedMatch.conflicts.length > 0 && (
                <div className="detail-section">
                  <h5>冲突信息 ({selectedMatch.conflicts.length} 个)</h5>
                  <div className="conflict-list">
                    {selectedMatch.conflicts.map((c, i) => (
                      <div key={i} className={`conflict-item conflict-${c.severity}`}>
                        <span className="conflict-type">{getConflictTypeLabel(c.type)}</span>
                        <span className="conflict-desc">{c.description}</span>
                        <span className={`conflict-status ${c.resolved ? 'resolved' : 'unresolved'}`}>
                          {c.resolved ? '已解决' : '待处理'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h5>操作历史</h5>
                <div className="history-list">
                  {selectedMatch.matchHistory.map((item, i) => (
                    <div key={i} className="history-item">
                      <span className="history-time">{formatDateTime(item.timestamp)}</span>
                      <span className="history-action">{item.action}</span>
                      <span className="history-operator">{item.operator}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
