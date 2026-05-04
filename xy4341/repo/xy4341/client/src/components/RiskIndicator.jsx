import React from 'react';
import { Card, Progress } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';

function RiskIndicator({ risk }) {
  if (!risk) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h3 className="panel-title">风险评估</h3>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <CheckCircleOutlined className="empty-state-icon" />
            <p>暂无风险数据</p>
          </div>
        </div>
      </div>
    );
  }

  const { overall_score, risk_level } = risk;
  
  const getRiskColor = (score) => {
    if (score >= 80) return '#ff4d4f';
    if (score >= 60) return '#ff7a45';
    if (score >= 40) return '#faad14';
    if (score >= 20) return '#95de64';
    return '#52c41a';
  };

  const getRiskText = (score) => {
    if (score >= 80) return '极度危险';
    if (score >= 60) return '高风险';
    if (score >= 40) return '中等风险';
    if (score >= 20) return '低风险';
    return '安全';
  };

  const riskColor = getRiskColor(overall_score);
  const riskText = getRiskText(overall_score);

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">风险评估</h3>
        {overall_score >= 40 && (
          <WarningOutlined style={{ color: '#faad14' }} />
        )}
      </div>
      <div className="panel-body">
        <div className="risk-indicator">
          <div 
            className="risk-score-circle"
            style={{ background: `conic-gradient(${riskColor} ${overall_score}%, #f0f0f0 0%)` }}
          >
            <span className="risk-score-value" style={{ color: riskColor }}>
              {Math.round(overall_score)}
            </span>
          </div>
          
          <div className={`risk-level-text ${risk_level || getRiskText(overall_score).toLowerCase()}`}>
            {riskText}
          </div>
          
          <Progress 
            percent={overall_score} 
            strokeColor={riskColor}
            showInfo={false}
          />
          
          <div className="risk-details">
            <div className="risk-detail-item">
              <div className="risk-detail-label">拥堵评分</div>
              <div className="risk-detail-value" style={{ color: getRiskColor(risk.congestion_score || 0) }}>
                {Math.round(risk.congestion_score || 0)}
              </div>
            </div>
            <div className="risk-detail-item">
              <div className="risk-detail-label">火势评分</div>
              <div className="risk-detail-value" style={{ color: getRiskColor(risk.fire_spread_score || 0) }}>
                {Math.round(risk.fire_spread_score || 0)}
              </div>
            </div>
            <div className="risk-detail-item">
              <div className="risk-detail-label">出口评分</div>
              <div className="risk-detail-value" style={{ color: getRiskColor(risk.exit_availability_score || 0) }}>
                {Math.round(risk.exit_availability_score || 0)}
              </div>
            </div>
            <div className="risk-detail-item">
              <div className="risk-detail-label">进度评分</div>
              <div className="risk-detail-value" style={{ color: getRiskColor(risk.evacuation_progress_score || 0) }}>
                {Math.round(risk.evacuation_progress_score || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskIndicator;
