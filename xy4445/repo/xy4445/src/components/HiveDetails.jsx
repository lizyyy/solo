import React, { useState } from 'react';
import { RISK_TYPES, RISK_LEVELS, HIVE_STATUS, QUEEN_STATUS } from '../models';
import './HiveDetails.css';

const HiveDetails = ({ 
  hive, 
  riskAssessment, 
  sensorData, 
  inspectionRecords, 
  wateringSchedule,
  reviewNote,
  onUpdateReviewNote,
  onClose
}) => {
  const [noteContent, setNoteContent] = useState(reviewNote?.content || '');
  const [noteStatus, setNoteStatus] = useState(reviewNote?.status || 'pending');

  if (!hive) {
    return (
      <div className="hive-details-empty">
        <p>请选择一个蜂箱查看详情</p>
      </div>
    );
  }

  const getRiskIcon = (riskType) => {
    switch (riskType) {
      case RISK_TYPES.OVERHEATING: return '🔥';
      case RISK_TYPES.WATER_SHORTAGE: return '💧';
      case RISK_TYPES.QUEEN_ABNORMALITY: return '👑';
      case RISK_TYPES.ROBBING_RISK: return '🐝';
      default: return '⚠️';
    }
  };

  const getRiskName = (riskType) => {
    switch (riskType) {
      case RISK_TYPES.OVERHEATING: return '过热风险';
      case RISK_TYPES.WATER_SHORTAGE: return '缺水风险';
      case RISK_TYPES.QUEEN_ABNORMALITY: return '蜂王异常';
      case RISK_TYPES.ROBBING_RISK: return '盗蜂风险';
      default: return '未知风险';
    }
  };

  const getLevelName = (level) => {
    switch (level) {
      case RISK_LEVELS.HIGH: return '高风险';
      case RISK_LEVELS.MEDIUM: return '中风险';
      case RISK_LEVELS.LOW: return '低风险';
      default: return '未知';
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case RISK_LEVELS.HIGH: return '#ef4444';
      case RISK_LEVELS.MEDIUM: return '#f59e0b';
      case RISK_LEVELS.LOW: return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case HIVE_STATUS.CRITICAL: 
        return { text: '紧急处理', color: '#ef4444', bg: '#fef2f2' };
      case HIVE_STATUS.AT_RISK: 
        return { text: '需要关注', color: '#f59e0b', bg: '#fffbeb' };
      case HIVE_STATUS.HEALTHY: 
        return { text: '正常', color: '#10b981', bg: '#f0fdf4' };
      default: 
        return { text: '未知', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const getQueenStatusName = (status) => {
    switch (status) {
      case QUEEN_STATUS.NORMAL: return '正常';
      case QUEEN_STATUS.LAYING: return '产卵中';
      case QUEEN_STATUS.UNSEEN: return '未见';
      case QUEEN_STATUS.ABNORMAL: return '异常';
      default: return '未知';
    }
  };

  const handleSaveNote = () => {
    onUpdateReviewNote(hive.id, {
      content: noteContent,
      status: noteStatus
    });
  };

  const statusBadge = getStatusBadge(riskAssessment?.overallStatus || HIVE_STATUS.HEALTHY);

  return (
    <div className="hive-details-container">
      <div className="hive-details-header">
        <div className="hive-header-left">
          <h3 className="hive-title">蜂箱 {hive.id}</h3>
          <span 
            className="status-badge"
            style={{ 
              backgroundColor: statusBadge.bg, 
              color: statusBadge.color 
            }}
          >
            {statusBadge.text}
          </span>
        </div>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="hive-info-section">
        <h4>基本信息</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">位置坐标</span>
            <span className="info-value">({hive.x}, {hive.y})</span>
          </div>
          <div className="info-item">
            <span className="info-label">蜂王状态</span>
            <span className="info-value">{getQueenStatusName(hive.queenStatus)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">蜂群数量</span>
            <span className="info-value">{hive.colonyCount || '未知'}</span>
          </div>
          {hive.establishedDate && (
            <div className="info-item">
              <span className="info-label">建立日期</span>
              <span className="info-value">{hive.establishedDate}</span>
            </div>
          )}
        </div>
      </div>

      {sensorData && (
        <div className="sensor-data-section">
          <h4>温湿度数据</h4>
          <div className="sensor-grid">
            <div className="sensor-item">
              <span className="sensor-icon">🌡️</span>
              <div className="sensor-info">
                <span className="sensor-label">温度</span>
                <span className="sensor-value">{sensorData.temperature}°C</span>
              </div>
            </div>
            <div className="sensor-item">
              <span className="sensor-icon">💧</span>
              <div className="sensor-info">
                <span className="sensor-label">湿度</span>
                <span className="sensor-value">{sensorData.humidity}%</span>
              </div>
            </div>
          </div>
          {sensorData.timestamp && (
            <p className="sensor-time">更新时间: {new Date(sensorData.timestamp).toLocaleString('zh-CN')}</p>
          )}
        </div>
      )}

      {wateringSchedule && (
        <div className="watering-section">
          <h4>补水遮阴安排</h4>
          <div className="info-grid">
            {wateringSchedule.lastWatering && (
              <div className="info-item">
                <span className="info-label">上次补水</span>
                <span className="info-value">{wateringSchedule.lastWatering}</span>
              </div>
            )}
            {wateringSchedule.nextWatering && (
              <div className="info-item">
                <span className="info-label">下次补水</span>
                <span className="info-value">{wateringSchedule.nextWatering}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">遮阴状态</span>
              <span className={`info-value ${wateringSchedule.shadingEnabled ? 'enabled' : 'disabled'}`}>
                {wateringSchedule.shadingEnabled ? '已开启' : '未开启'}
              </span>
            </div>
          </div>
          {wateringSchedule.shadingNotes && (
            <p className="watering-notes">备注: {wateringSchedule.shadingNotes}</p>
          )}
        </div>
      )}

      {riskAssessment && riskAssessment.risks.length > 0 && (
        <div className="risks-section">
          <h4>检测到的风险 ({riskAssessment.risks.length})</h4>
          <div className="risks-list">
            {riskAssessment.risks.map((risk, index) => (
              <div key={index} className="risk-item">
                <div className="risk-header">
                  <span className="risk-icon">{getRiskIcon(risk.type)}</span>
                  <span className="risk-name">{getRiskName(risk.type)}</span>
                  <span 
                    className="risk-level"
                    style={{ color: getLevelColor(risk.level) }}
                  >
                    {getLevelName(risk.level)}
                  </span>
                </div>
                <p className="risk-description">{risk.description}</p>
                {risk.recommendations && risk.recommendations.length > 0 && (
                  <div className="recommendations">
                    <span className="recommendations-label">建议: </span>
                    <span className="recommendations-text">{risk.recommendations.join('、')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {inspectionRecords && inspectionRecords.length > 0 && (
        <div className="inspection-section">
          <h4>最近检查记录</h4>
          <div className="inspection-list">
            {inspectionRecords.slice(-3).reverse().map((record, index) => (
              <div key={index} className="inspection-item">
                <div className="inspection-header">
                  <span className="inspection-date">{record.inspectionDate}</span>
                  <span className={`inspection-queen ${record.queenObserved ? 'observed' : 'not-observed'}`}>
                    {record.queenObserved ? '✓ 见王' : '✗ 未见王'}
                  </span>
                </div>
                {record.notes && (
                  <p className="inspection-notes">{record.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="review-note-section">
        <h4>人工复核备注</h4>
        <div className="note-form">
          <div className="status-selector">
            <label>复核状态:</label>
            <select 
              value={noteStatus}
              onChange={(e) => setNoteStatus(e.target.value)}
              className="status-dropdown"
            >
              <option value="pending">待处理</option>
              <option value="in_progress">处理中</option>
              <option value="resolved">已解决</option>
              <option value="no_action">无需处理</option>
            </select>
          </div>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="输入复核备注..."
            className="note-textarea"
            rows="4"
          />
          <button 
            onClick={handleSaveNote}
            className="save-note-button"
          >
            保存备注
          </button>
        </div>
        {reviewNote?.updatedAt && (
          <p className="note-update-time">
            上次更新: {new Date(reviewNote.updatedAt).toLocaleString('zh-CN')}
          </p>
        )}
      </div>
    </div>
  );
};

export default HiveDetails;
