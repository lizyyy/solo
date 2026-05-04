import { useState } from 'react';
import { RiskEvent } from '../types';
import './RiskListPanel.css';

interface RiskListPanelProps {
  risks: RiskEvent[];
  currentTime: number;
  onReviewRisk: (
    riskId: string,
    isReviewed: boolean,
    reviewNotes?: string,
    reviewResult?: RiskEvent['reviewResult']
  ) => void;
  onJumpToRisk: (risk: RiskEvent) => void;
}

const RISK_TYPE_MAP: Record<RiskEvent['type'], string> = {
  retrograde: '逆行',
  stagnation: '滞留',
  wrongDoorClose: '误关门',
  waterDetourFailure: '积水绕行失败',
  other: '其他'
};

const SEVERITY_MAP: Record<RiskEvent['severity'], { label: string; class: string }> = {
  low: { label: '低', class: 'severity-low' },
  medium: { label: '中', class: 'severity-medium' },
  high: { label: '高', class: 'severity-high' },
  critical: { label: '严重', class: 'severity-critical' }
};

const RiskListPanel = ({ risks, currentTime, onReviewRisk, onJumpToRisk }: RiskListPanelProps) => {
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<RiskEvent['type'] | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'reviewed' | 'pending'>('all');

  const filteredRisks = risks.filter(risk => {
    const typeMatch = filterType === 'all' || risk.type === filterType;
    const statusMatch = filterStatus === 'all' ||
      (filterStatus === 'reviewed' && risk.isReviewed) ||
      (filterStatus === 'pending' && !risk.isReviewed);
    return typeMatch && statusMatch;
  });

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const isRiskActive = (risk: RiskEvent): boolean => {
    const startTime = risk.startTime;
    const endTime = risk.endTime || risk.startTime + 60000;
    return currentTime >= startTime && currentTime <= endTime;
  };

  const handleReviewResult = (riskId: string, result: RiskEvent['reviewResult']) => {
    onReviewRisk(riskId, true, undefined, result);
  };

  const handleAddNote = (riskId: string, notes: string) => {
    const risk = risks.find(r => r.id === riskId);
    if (risk) {
      onReviewRisk(riskId, risk.isReviewed, notes, risk.reviewResult);
    }
  };

  return (
    <div className="risk-list-panel">
      <div className="panel-header">
        ⚠️ 风险事件列表
        <span className="risk-count-badge">{risks.length}</span>
      </div>

      {/* 筛选器 */}
      <div className="filters">
        <select
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
        >
          <option value="all">全部类型</option>
          <option value="retrograde">逆行</option>
          <option value="stagnation">滞留</option>
          <option value="wrongDoorClose">误关门</option>
          <option value="waterDetourFailure">积水绕行失败</option>
        </select>

        <select
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
        >
          <option value="all">全部状态</option>
          <option value="pending">待复核</option>
          <option value="reviewed">已复核</option>
        </select>
      </div>

      {/* 风险列表 */}
      <div className="risk-list">
        {filteredRisks.length === 0 ? (
          <div className="empty-risks">
            <div className="empty-icon">✓</div>
            <p>暂无匹配的风险事件</p>
          </div>
        ) : (
          filteredRisks.map(risk => (
            <div
              key={risk.id}
              className={`risk-item ${risk.isReviewed ? 'reviewed' : ''} ${isRiskActive(risk) ? 'active' : ''}`}
            >
              {/* 风险头部 */}
              <div
                className="risk-header"
                onClick={() => setExpandedRiskId(expandedRiskId === risk.id ? null : risk.id)}
              >
                <div className="risk-main-info">
                  <span className={`severity-badge ${SEVERITY_MAP[risk.severity].class}`}>
                    {SEVERITY_MAP[risk.severity].label}
                  </span>
                  <span className="risk-type">{RISK_TYPE_MAP[risk.type]}</span>
                </div>
                <div className="risk-time">{formatTime(risk.timestamp)}</div>
                <div className={`expand-arrow ${expandedRiskId === risk.id ? 'expanded' : ''}`}>
                  ▼
                </div>
              </div>

              {/* 风险详情 */}
              {expandedRiskId === risk.id && (
                <div className="risk-details">
                  <div className="risk-description">{risk.description}</div>
                  
                  <div className="risk-meta">
                    {risk.personName && (
                      <div className="meta-item">
                        <span className="meta-label">涉及人员:</span>
                        <span className="meta-value">{risk.personName}</span>
                      </div>
                    )}
                    {risk.deviceName && (
                      <div className="meta-item">
                        <span className="meta-label">涉及设备:</span>
                        <span className="meta-value">{risk.deviceName}</span>
                      </div>
                    )}
                    <div className="meta-item">
                      <span className="meta-label">位置:</span>
                      <span className="meta-value">{risk.location.section}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">持续时间:</span>
                      <span className="meta-value">
                        {risk.endTime 
                          ? `${Math.round((risk.endTime - risk.startTime) / 1000)}秒`
                          : '进行中'}
                      </span>
                    </div>
                  </div>

                  {/* 证据链 */}
                  <div className="evidence-section">
                    <div className="evidence-title">📋 证据链</div>
                    <ul className="evidence-list">
                      {risk.evidence.map((item, index) => (
                        <li key={index} className="evidence-item">{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 操作按钮 */}
                  <div className="risk-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToRisk(risk);
                      }}
                    >
                      🎯 跳转到该时间点
                    </button>
                  </div>

                  {/* 复核区域 */}
                  <div className="review-section">
                    <div className="review-title">
                      {risk.isReviewed ? '✅ 已复核' : '⏳ 待复核'}
                    </div>
                    
                    {!risk.isReviewed && (
                      <div className="review-actions">
                        <span className="review-label">标记为:</span>
                        <button
                          className="btn btn-success btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewResult(risk.id, 'confirmed');
                          }}
                        >
                          ✓ 确认风险
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewResult(risk.id, 'falsePositive');
                          }}
                        >
                          ✗ 误报
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewResult(risk.id, 'needsInvestigation');
                          }}
                        >
                          ❓ 需调查
                        </button>
                      </div>
                    )}

                    {risk.reviewResult && (
                      <div className="review-result">
                        <strong>复核结果:</strong> {
                          risk.reviewResult === 'confirmed' ? '确认风险' :
                          risk.reviewResult === 'falsePositive' ? '误报' :
                          '需进一步调查'
                        }
                      </div>
                    )}

                    {risk.reviewNotes && (
                      <div className="review-notes">
                        <strong>复核备注:</strong> {risk.reviewNotes}
                      </div>
                    )}

                    {/* 添加备注 */}
                    <NoteInput
                      riskId={risk.id}
                      currentNotes={risk.reviewNotes}
                      onAddNote={handleAddNote}
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 备注输入子组件
const NoteInput = ({
  riskId,
  currentNotes,
  onAddNote
}: {
  riskId: string;
  currentNotes?: string;
  onAddNote: (riskId: string, notes: string) => void;
}) => {
  const [notes, setNotes] = useState(currentNotes || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onAddNote(riskId, notes);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="note-input">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="添加复核备注..."
          rows={2}
        />
        <div className="note-actions">
          <button className="btn btn-secondary btn-small" onClick={() => setIsEditing(false)}>
            取消
          </button>
          <button className="btn btn-primary btn-small" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="add-note-btn"
      onClick={() => setIsEditing(true)}
    >
      📝 {currentNotes ? '编辑备注' : '添加备注'}
    </button>
  );
};

export default RiskListPanel;
