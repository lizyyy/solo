import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { 
  getCongestionRiskLabel, 
  formatTimeSlot 
} from '../../services/dataProcessor';
import type { 
  CoachNote, 
  GradeOverride
} from '../../types';
import { DIFFICULTY_ORDER } from '../../types';
import './RouteDetail.css';

const RouteDetail: React.FC = () => {
  const { 
    state, 
    dispatch,
    getRouteStats, 
    getRouteAlerts, 
    getRouteCoachNotes, 
    getRouteGradeOverrides,
    addCoachNote,
    addGradeOverride,
    acknowledgeAlert
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'overrides'>('overview');
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<CoachNote['category']>('observation');
  const [coachName, setCoachName] = useState('');
  const [newOverrideOriginal, setNewOverrideOriginal] = useState('');
  const [newOverrideNew, setNewOverrideNew] = useState('');
  const [newOverrideReason, setNewOverrideReason] = useState('');

  const selectedRoute = state.data.routes.find(r => r.id === state.selectedRouteId);
  
  if (!selectedRoute || !state.selectedRouteId) {
    return (
      <div className="route-detail route-detail--empty">
        <div className="route-detail__empty-icon">👆</div>
        <h4>选择线路查看详情</h4>
        <p>点击左侧线路卡片查看详细统计、备注和改判记录</p>
      </div>
    );
  }

  const stats = getRouteStats(state.selectedRouteId);
  const routeAlerts = getRouteAlerts(state.selectedRouteId);
  const coachNotes = getRouteCoachNotes(state.selectedRouteId);
  const gradeOverrides = getRouteGradeOverrides(state.selectedRouteId);

  const handleAddNote = () => {
    if (!newNote.trim() || !coachName.trim()) return;
    
    addCoachNote(
      state.selectedRouteId!,
      newNote.trim(),
      noteCategory,
      coachName.trim()
    );
    
    setNewNote('');
    setNoteCategory('observation');
  };

  const handleAddOverride = () => {
    if (!newOverrideOriginal || !newOverrideNew || !newOverrideReason.trim() || !coachName.trim()) return;
    if (newOverrideOriginal === newOverrideNew) return;
    
    addGradeOverride(
      state.selectedRouteId!,
      newOverrideOriginal,
      newOverrideNew,
      newOverrideReason.trim(),
      coachName.trim()
    );
    
    setNewOverrideOriginal('');
    setNewOverrideNew('');
    setNewOverrideReason('');
  };

  const getDifficultyColor = (difficulty: string): string => {
    const colors: Record<string, string> = {
      'V0': '#22c55e',
      'V1': '#4ade80',
      'V2': '#84cc16',
      'V3': '#eab308',
      'V4': '#f97316',
      'V5': '#ef4444',
      'V6': '#dc2626',
      'V7': '#b91c1c',
      'V8': '#7f1d1d',
      'V9': '#431407',
      'V10+': '#1a1a1a'
    };
    return colors[difficulty] || '#6b7280';
  };

  const getCategoryLabel = (category: CoachNote['category']): string => {
    const labels: Record<string, string> = {
      observation: '观察',
      suggestion: '建议',
      grade_adjustment: '难度调整',
      safety: '安全'
    };
    return labels[category] || category;
  };

  const getCategoryBadgeClass = (category: CoachNote['category']): string => {
    const classes: Record<string, string> = {
      observation: 'category--observation',
      suggestion: 'category--suggestion',
      grade_adjustment: 'category--adjustment',
      safety: 'category--safety'
    };
    return classes[category] || '';
  };

  const getStatusLabel = (status: GradeOverride['status']): string => {
    const labels: Record<string, string> = {
      pending: '待审核',
      approved: '已批准',
      rejected: '已拒绝'
    };
    return labels[status] || status;
  };

  const getStatusBadgeClass = (status: GradeOverride['status']): string => {
    const classes: Record<string, string> = {
      pending: 'status--pending',
      approved: 'status--approved',
      rejected: 'status--rejected'
    };
    return classes[status] || '';
  };

  const handleClose = () => {
    dispatch({ type: 'SELECT_ROUTE', payload: null });
  };

  return (
    <div className="route-detail">
      <div className="route-detail__header">
        <div className="route-detail__route-info">
          <div 
            className="route-detail__difficulty-badge"
            style={{ backgroundColor: getDifficultyColor(selectedRoute.difficulty) }}
          >
            {selectedRoute.difficulty}
          </div>
          <div>
            <h3 className="route-detail__name">{selectedRoute.name}</h3>
            <div className="route-detail__meta">
              <span>📍 {selectedRoute.zone}</span>
              {selectedRoute.setter && <span>👤 {selectedRoute.setter}</span>}
              {selectedRoute.setDate && <span>📅 {selectedRoute.setDate}</span>}
            </div>
          </div>
        </div>
        <button 
          className="route-detail__close-btn"
          onClick={handleClose}
        >
          ×
        </button>
      </div>

      {routeAlerts.length > 0 && (
        <div className="route-detail__alerts">
          <div className="route-detail__alerts-header">
            <span className="route-detail__alerts-icon">⚠️</span>
            <span>异常提醒 ({routeAlerts.filter(a => !a.acknowledged).length})</span>
          </div>
          <div className="route-detail__alerts-list">
            {routeAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`route-detail__alert-item ${alert.acknowledged ? 'route-detail__alert-item--acknowledged' : ''}`}
              >
                <div className="route-detail__alert-content">
                  <div className="route-detail__alert-title">
                    <span className={`route-detail__alert-severity route-detail__alert-severity--${alert.severity}`}>
                      {alert.severity === 'high' ? '高' : alert.severity === 'medium' ? '中' : '低'}
                    </span>
                    {alert.message}
                  </div>
                  <div className="route-detail__alert-details">{alert.details}</div>
                </div>
                {!alert.acknowledged && (
                  <button
                    className="route-detail__alert-acknowledge"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    确认
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="route-detail__tabs">
        <button
          className={`route-detail__tab ${activeTab === 'overview' ? 'route-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          统计概览
        </button>
        <button
          className={`route-detail__tab ${activeTab === 'notes' ? 'route-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          教练备注 ({coachNotes.length})
        </button>
        <button
          className={`route-detail__tab ${activeTab === 'overrides' ? 'route-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('overrides')}
        >
          难度改判 ({gradeOverrides.length})
        </button>
      </div>

      <div className="route-detail__content">
        {activeTab === 'overview' && stats && (
          <div className="route-detail__overview">
            <div className="route-detail__stats-grid">
              <div className="route-detail__stat-card">
                <div className="route-detail__stat-value">{stats.successRate.toFixed(1)}%</div>
                <div className="route-detail__stat-label">完攀率</div>
              </div>
              <div className="route-detail__stat-card">
                <div className="route-detail__stat-value">{stats.totalAttempts}</div>
                <div className="route-detail__stat-label">总尝试次数</div>
              </div>
              <div className="route-detail__stat-card">
                <div className="route-detail__stat-value">{stats.successfulAscents}</div>
                <div className="route-detail__stat-label">完攀次数</div>
              </div>
              <div className="route-detail__stat-card">
                <div className="route-detail__stat-value">{stats.uniqueClimbers}</div>
                <div className="route-detail__stat-label">独立攀岩者</div>
              </div>
              <div className="route-detail__stat-card">
                <div className="route-detail__stat-value">{stats.avgAttemptsPerSuccess.toFixed(1)}</div>
                <div className="route-detail__stat-label">平均尝试次数</div>
              </div>
              <div className="route-detail__stat-card">
                <div className={`route-detail__stat-value ${
                  stats.congestionRisk === 'high' ? 'text-red-500' : 
                  stats.congestionRisk === 'medium' ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {getCongestionRiskLabel(stats.congestionRisk)}
                </div>
                <div className="route-detail__stat-label">拥堵风险</div>
              </div>
            </div>

            {stats.popularTimeSlots.length > 0 && (
              <div className="route-detail__section">
                <h4 className="route-detail__section-title">热门时段</h4>
                <div className="route-detail__time-slots">
                  {stats.popularTimeSlots.map((slot, index) => (
                    <div key={index} className="route-detail__time-slot-item">
                      <div className="route-detail__time-slot-time">{formatTimeSlot(slot)}</div>
                      <div className="route-detail__time-slot-bar">
                        <div 
                          className="route-detail__time-slot-fill"
                          style={{ width: `${slot.percentage}%` }}
                        ></div>
                      </div>
                      <div className="route-detail__time-slot-percent">{slot.percentage.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="route-detail__section">
              <h4 className="route-detail__section-title">近期趋势</h4>
              <div className={`route-detail__trend-badge route-detail__trend-badge--${stats.recentTrend}`}>
                {stats.recentTrend === 'improving' ? '📈 完攀率上升' :
                 stats.recentTrend === 'declining' ? '📉 完攀率下降' :
                 '➡️ 保持稳定'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="route-detail__notes">
            <div className="route-detail__add-note">
              <h4 className="route-detail__section-title">添加备注</h4>
              
              <div className="route-detail__form-row">
                <div className="route-detail__form-group">
                  <label>教练姓名</label>
                  <input
                    type="text"
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    placeholder="请输入您的姓名"
                  />
                </div>
                <div className="route-detail__form-group">
                  <label>备注类型</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value as CoachNote['category'])}
                  >
                    <option value="observation">观察</option>
                    <option value="suggestion">建议</option>
                    <option value="grade_adjustment">难度调整</option>
                    <option value="safety">安全</option>
                  </select>
                </div>
              </div>
              
              <div className="route-detail__form-group">
                <label>备注内容</label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="输入您的观察或建议..."
                  rows={3}
                />
              </div>
              
              <button
                className="route-detail__add-btn"
                onClick={handleAddNote}
                disabled={!newNote.trim() || !coachName.trim()}
              >
                添加备注
              </button>
            </div>

            {coachNotes.length > 0 ? (
              <div className="route-detail__notes-list">
                <h4 className="route-detail__section-title">历史备注</h4>
                {[...coachNotes].reverse().map(note => (
                  <div key={note.id} className="route-detail__note-item">
                    <div className="route-detail__note-header">
                      <span className={`route-detail__note-category ${getCategoryBadgeClass(note.category)}`}>
                        {getCategoryLabel(note.category)}
                      </span>
                      <span className="route-detail__note-author">
                        {note.coachName} · {new Date(note.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="route-detail__note-content">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="route-detail__empty-notes">
                <p>暂无教练备注</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'overrides' && (
          <div className="route-detail__overrides">
            <div className="route-detail__add-override">
              <h4 className="route-detail__section-title">申请难度改判</h4>
              
              <div className="route-detail__form-row">
                <div className="route-detail__form-group">
                  <label>教练姓名</label>
                  <input
                    type="text"
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    placeholder="请输入您的姓名"
                  />
                </div>
              </div>
              
              <div className="route-detail__form-row">
                <div className="route-detail__form-group">
                  <label>原难度</label>
                  <select
                    value={newOverrideOriginal}
                    onChange={(e) => setNewOverrideOriginal(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {DIFFICULTY_ORDER.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="route-detail__form-group">
                  <label>→ 新难度</label>
                  <select
                    value={newOverrideNew}
                    onChange={(e) => setNewOverrideNew(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {DIFFICULTY_ORDER.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="route-detail__form-group">
                <label>改判理由</label>
                <textarea
                  value={newOverrideReason}
                  onChange={(e) => setNewOverrideReason(e.target.value)}
                  placeholder="详细说明改判原因..."
                  rows={3}
                />
              </div>
              
              <button
                className="route-detail__add-btn"
                onClick={handleAddOverride}
                disabled={!newOverrideOriginal || !newOverrideNew || newOverrideOriginal === newOverrideNew || !newOverrideReason.trim() || !coachName.trim()}
              >
                提交改判申请
              </button>
            </div>

            {gradeOverrides.length > 0 ? (
              <div className="route-detail__overrides-list">
                <h4 className="route-detail__section-title">改判历史</h4>
                {[...gradeOverrides].reverse().map(override => (
                  <div key={override.id} className="route-detail__override-item">
                    <div className="route-detail__override-header">
                      <span className={`route-detail__override-status ${getStatusBadgeClass(override.status)}`}>
                        {getStatusLabel(override.status)}
                      </span>
                      <span className="route-detail__override-author">
                        {override.coachName} · {new Date(override.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="route-detail__override-grade-change">
                      <span 
                        className="route-detail__override-grade"
                        style={{ backgroundColor: getDifficultyColor(override.originalGrade) }}
                      >
                        {override.originalGrade}
                      </span>
                      <span className="route-detail__override-arrow">→</span>
                      <span 
                        className="route-detail__override-grade"
                        style={{ backgroundColor: getDifficultyColor(override.newGrade) }}
                      >
                        {override.newGrade}
                      </span>
                    </div>
                    <p className="route-detail__override-reason">{override.reason}</p>
                    {override.reviewerName && (
                      <p className="route-detail__override-review">
                        审核人: {override.reviewerName}
                        {override.reviewDate && ` · ${new Date(override.reviewDate).toLocaleString('zh-CN')}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="route-detail__empty-overrides">
                <p>暂无难度改判记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteDetail;
