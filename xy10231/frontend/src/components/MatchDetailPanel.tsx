import { useState } from 'react';
import { MatchDetail } from '../api';

interface Props {
  detail: MatchDetail;
  onClose: () => void;
  onFeedback: (matchId: string, feedbackType: string, note: string, operator: string) => void;
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleString('zh-CN');
}

export function MatchDetailPanel({ detail, onClose, onFeedback }: Props) {
  const [feedbackType, setFeedbackType] = useState<'confirm' | 'reject' | 'note'>('confirm');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [operator, setOperator] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onFeedback(detail.match.id, feedbackType, feedbackNote, operator || 'anonymous');
    } finally {
      setSubmitting(false);
    }
  };

  const { match, feedback, changes } = detail;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3>匹配详情</h3>
        <button className="detail-close" onClick={onClose}>×</button>
      </div>
      
      <div className="detail-body">
        <div className="detail-section">
          <h4>📊 匹配信息</h4>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className={`score-badge ${match.confidence}`} style={{ fontSize: '1rem' }}>
              {match.match_score.toFixed(1)} 分
            </div>
            <div className={`score-badge ${match.confidence}`} style={{ fontSize: '1rem' }}>
              {match.confidence === 'high' ? '高置信' : match.confidence === 'medium' ? '中置信' : '低置信'}
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            匹配ID: {match.id.substring(0, 8)}...
          </p>
        </div>
        
        <div className="detail-section">
          <h4>📝 乘客报失</h4>
          <div className="match-side" style={{ marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>{match.lost_description}</p>
            <div className="match-tags">
              {match.lost_category && <span className="tag primary">分类: {match.lost_category}</span>}
              {match.lost_line && <span className="tag">线路: {match.lost_line}</span>}
              {match.lost_station && <span className="tag">站点: {match.lost_station}</span>}
              {match.lost_date && <span className="tag">日期: {match.lost_date}</span>}
            </div>
          </div>
        </div>
        
        <div className="detail-section">
          <h4>🔍 招领信息</h4>
          <div className="match-side">
            <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>{match.found_description}</p>
            <div className="match-tags">
              {match.found_category && <span className="tag primary">分类: {match.found_category}</span>}
              {match.found_line && <span className="tag">线路: {match.found_line}</span>}
              {match.found_station && <span className="tag">站点: {match.found_station}</span>}
              {match.found_date && <span className="tag">日期: {match.found_date}</span>}
            </div>
          </div>
        </div>
        
        {feedback.length > 0 && (
          <div className="detail-section">
            <h4>💬 历史反馈</h4>
            <div className="changelog">
              {feedback.map((f) => (
                <div key={f.id} className="changelog-item">
                  <div className="changelog-time">{formatTime(f.created_at)}</div>
                  <div className="changelog-content">
                    <strong>{f.feedback_type === 'confirm' ? '✅ 确认' : f.feedback_type === 'reject' ? '❌ 驳回' : '📝 备注'}</strong>
                    {f.operator && ` (${f.operator})`}
                    {f.feedback_note && <div style={{ marginTop: '0.25rem' }}>{f.feedback_note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {changes.length > 0 && (
          <div className="detail-section">
            <h4>📜 变更历史</h4>
            <div className="changelog">
              {changes.map((c) => (
                <div key={c.id} className="changelog-item">
                  <div className="changelog-time">{formatTime(c.created_at)}</div>
                  <div className="changelog-content">
                    <strong>{c.field_name}</strong>: 
                    {c.old_value && ` ${c.old_value} →`} 
                    {c.new_value && ` ${c.new_value}`}
                    <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                      ({c.operator})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="feedback-form">
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.5rem', display: 'block' }}>
            操作人
          </label>
          <input
            className="operator-input"
            placeholder="输入操作人姓名"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
          />
        </div>
        
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.5rem', display: 'block' }}>
            反馈类型
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-sm ${feedbackType === 'confirm' ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => setFeedbackType('confirm')}
            >
              ✅ 确认匹配
            </button>
            <button
              className={`btn btn-sm ${feedbackType === 'reject' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setFeedbackType('reject')}
            >
              ❌ 驳回
            </button>
            <button
              className={`btn btn-sm ${feedbackType === 'note' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFeedbackType('note')}
            >
              📝 备注
            </button>
          </div>
        </div>
        
        <textarea
          placeholder="输入反馈备注（可选）..."
          value={feedbackNote}
          onChange={(e) => setFeedbackNote(e.target.value)}
        />
        
        <div className="button-group">
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button 
            className={feedbackType === 'confirm' ? 'btn btn-success' : feedbackType === 'reject' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '提交反馈'}
          </button>
        </div>
      </div>
    </div>
  );
}
