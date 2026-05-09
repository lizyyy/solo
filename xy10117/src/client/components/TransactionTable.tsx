import React from 'react';
import { Transaction, FEATURE_NAMES } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onViewDetail: (tx: Transaction) => void;
  onPageChange: (page: number) => void;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getScoreClass(score: number): string {
  if (score >= 60) return 'score-high';
  if (score >= 30) return 'score-medium';
  return 'score-low';
}

function getStatusBadge(tx: Transaction): React.ReactNode {
  if (!tx.reviewed) {
    return <span className="badge badge-warning">待复核</span>;
  }
  if (tx.review_decision === 'confirmed') {
    return <span className="badge badge-danger">已确认异常</span>;
  }
  if (tx.review_decision === 'rejected') {
    return <span className="badge badge-success">误判</span>;
  }
  return <span className="badge badge-default">已复核</span>;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  total,
  page,
  pageSize,
  loading,
  onViewDetail,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <span className="loading"></span>
          <div className="text" style={{ marginTop: 16 }}>加载中...</div>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="icon">📭</div>
          <div className="text">暂无数据，请先导入交易数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>交易ID</th>
              <th>金额</th>
              <th>商户</th>
              <th>用户ID</th>
              <th>风险分</th>
              <th>状态</th>
              <th>交易时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {tx.transaction_id.substring(0, 12)}...
                </td>
                <td>¥{tx.amount.toLocaleString()}</td>
                <td>{tx.merchant || '-'}</td>
                <td>{tx.user_id || '-'}</td>
                <td>
                  <span className={getScoreClass(tx.risk_score)}>
                    {tx.risk_score.toFixed(1)}
                  </span>
                </td>
                <td>{getStatusBadge(tx)}</td>
                <td>{formatDate(tx.transaction_time)}</td>
                <td>
                  <button
                    className="link-btn"
                    onClick={() => onViewDetail(tx)}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </button>
        <span className="page-info">
          第 {page} / {totalPages} 页，共 {total} 条
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
};
