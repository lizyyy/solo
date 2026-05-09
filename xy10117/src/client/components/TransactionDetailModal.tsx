import React, { useState, useEffect } from 'react';
import { Transaction, Explanation, VersionHistory, ReviewRequest, FEATURE_NAMES } from '../types';
import { api } from '../api';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdated: () => void;
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
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getActionName(action: string): string {
  const names: Record<string, string> = {
    import: '数据导入',
    review: '人工复核',
    rollback: '回滚操作',
  };
  return names[action] || action;
}

function getScoreClass(score: number): string {
  if (score >= 60) return 'score-high';
  if (score >= 30) return 'score-medium';
  return 'score-low';
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onUpdated,
}) => {
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [history, setHistory] = useState<VersionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'explanations' | 'history' | 'review'>('explanations');

  const [reviewer, setReviewer] = useState('');
  const [decision, setDecision] = useState<'confirmed' | 'rejected'>('rejected');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setLoading(true);
      api
        .getTransaction(transaction.transaction_id)
        .then((data) => {
          setExplanations(data.explanations);
          setHistory(data.version_history);
        })
        .finally(() => setLoading(false));
    }
  }, [transaction]);

  const handleSubmitReview = async () => {
    if (!transaction || !reviewer.trim()) {
      alert('请输入复核人姓名');
      return;
    }

    setSubmitting(true);
    try {
      const request: ReviewRequest = {
        transaction_id: transaction.transaction_id,
        decision,
        comment,
        reviewer: reviewer.trim(),
      };
      await api.reviewTransaction(request);
      alert('复核完成');
      onUpdated();
      onClose();
    } catch (err) {
      alert('复核失败: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollback = async () => {
    if (!transaction) return;
    if (!confirm('确定要回滚这条交易的复核状态吗？')) return;

    const operator = prompt('请输入操作人姓名：') || 'system';
    try {
      await api.rollbackTransaction(transaction.transaction_id, operator);
      alert('回滚完成');
      onUpdated();
      onClose();
    } catch (err) {
      alert('回滚失败: ' + (err as Error).message);
    }
  };

  if (!transaction) return null;

  const totalContribution = explanations.reduce((sum, e) => sum + e.contribution, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            交易详情 - 
            <span className={getScoreClass(transaction.risk_score)}>
              {' '}风险分: {transaction.risk_score.toFixed(1)}
            </span>
          </h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h4>📋 基本信息</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">交易ID</div>
                <div className="value">{transaction.transaction_id}</div>
              </div>
              <div className="detail-item">
                <div className="label">交易金额</div>
                <div className="value">¥{transaction.amount.toLocaleString()}</div>
              </div>
              <div className="detail-item">
                <div className="label">商户</div>
                <div className="value">{transaction.merchant || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">品类</div>
                <div className="value">{transaction.category || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">国家/地区</div>
                <div className="value">{transaction.country || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">用户ID</div>
                <div className="value">{transaction.user_id || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">设备ID</div>
                <div className="value">{transaction.device_id || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">交易时间</div>
                <div className="value">{formatDate(transaction.transaction_time)}</div>
              </div>
              <div className="detail-item">
                <div className="label">24h交易频次</div>
                <div className="value">{transaction.velocity_24h} 笔</div>
              </div>
              <div className="detail-item">
                <div className="label">金额偏离度</div>
                <div className="value">{transaction.amount_deviation.toFixed(2)}x</div>
              </div>
              <div className="detail-item">
                <div className="label">首次交易</div>
                <div className="value">{transaction.is_first_transaction ? '是' : '否'}</div>
              </div>
              <div className="detail-item">
                <div className="label">夜间/周末</div>
                <div className="value">
                  {transaction.is_night ? '夜间 ' : ''}
                  {transaction.is_weekend ? '周末' : '工作日'}
                </div>
              </div>
            </div>
          </div>

          {transaction.reviewed && (
            <div className="detail-section">
              <h4>📝 复核记录</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="label">复核结论</div>
                  <div className="value">
                    {transaction.review_decision === 'confirmed' ? (
                      <span className="badge badge-danger">确认异常</span>
                    ) : (
                      <span className="badge badge-success">误判</span>
                    )}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="label">复核人</div>
                  <div className="value">{transaction.reviewer || '-'}</div>
                </div>
                <div className="detail-item">
                  <div className="label">复核时间</div>
                  <div className="value">
                    {transaction.reviewed_at ? formatDate(transaction.reviewed_at) : '-'}
                  </div>
                </div>
              </div>
              {transaction.review_comment && (
                <div className="detail-item" style={{ marginTop: 12 }}>
                  <div className="label">复核意见</div>
                  <div className="value">{transaction.review_comment}</div>
                </div>
              )}
            </div>
          )}

          <div className="tabs" style={{ marginTop: 8 }}>
            <button
              className={`tab ${activeTab === 'explanations' ? 'active' : ''}`}
              onClick={() => setActiveTab('explanations')}
            >
              🔍 异常解释 ({explanations.length})
            </button>
            <button
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 版本历史 ({history.length})
            </button>
            <button
              className={`tab ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              ✍️ {transaction.reviewed ? '回滚' : '复核'}
            </button>
          </div>

          {activeTab === 'explanations' && (
            <div className="detail-section">
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <span className="loading"></span>
                </div>
              ) : explanations.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <div className="text">该交易未触发异常特征</div>
                </div>
              ) : (
                <div className="explanation-list">
                  {explanations.map((exp, idx) => (
                    <div key={exp.id} className="explanation-item">
                      <div className="explanation-header">
                        <div className="explanation-feature">
                          #{idx + 1} {FEATURE_NAMES[exp.feature] || exp.feature}
                        </div>
                        <div className="explanation-contribution">
                          +{exp.contribution.toFixed(1)} 分
                        </div>
                      </div>
                      <div className="explanation-value">
                        当前值: <strong>{exp.feature_value}</strong> | 阈值: {exp.threshold}
                      </div>
                      <div className="explanation-reason">💡 {exp.reason}</div>
                      <div className="contribution-bar">
                        <div
                          className="fill"
                          style={{
                            width: `${totalContribution > 0 ? (exp.contribution / totalContribution) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="detail-section">
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <span className="loading"></span>
                </div>
              ) : history.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}>
                  <div className="text">暂无历史记录</div>
                </div>
              ) : (
                <div className="version-timeline">
                  {history.map((item) => (
                    <div key={item.id} className={`version-item ${item.action}`}>
                      <div className="version-header">
                        <div className="version-action">{getActionName(item.action)}</div>
                        <div className="version-time">{formatDate(item.created_at)}</div>
                      </div>
                      <div className="version-operator">操作人: {item.operator}</div>
                      {item.old_value && (
                        <div className="version-content">
                          <del style={{ color: '#999' }}>{item.old_value}</del>
                          {' → '}
                          <strong>{item.new_value}</strong>
                        </div>
                      )}
                      {!item.old_value && (
                        <div className="version-content">
                          <strong>{item.new_value}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'review' && (
            <div className="detail-section">
              {transaction.reviewed ? (
                <div>
                  <div className="alert alert-info">
                    此交易已被复核。如复核有误，可执行回滚操作将其恢复为"待复核"状态。
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={handleRollback}
                    disabled={submitting}
                  >
                    🔄 执行回滚
                  </button>
                </div>
              ) : (
                <div>
                  <div className="form-group">
                    <label>复核人姓名 *</label>
                    <input
                      type="text"
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                      placeholder="请输入您的姓名"
                    />
                  </div>

                  <div className="form-group">
                    <label>复核结论 *</label>
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value as 'confirmed' | 'rejected')}
                    >
                      <option value="rejected">❌ 误判（模型判断错误，该交易正常）</option>
                      <option value="confirmed">✅ 确认异常（模型判断正确）</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>复核意见</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="请详细说明复核理由（可选）"
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitReview}
                    disabled={submitting || !reviewer.trim()}
                  >
                    {submitting ? '提交中...' : '📤 提交复核'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
