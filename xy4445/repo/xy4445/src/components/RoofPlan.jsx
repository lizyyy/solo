import React from 'react';
import { HIVE_STATUS, RISK_LEVELS } from '../models';
import './RoofPlan.css';

const RoofPlan = ({ hives, riskAssessments, selectedHive, onSelectHive }) => {
  if (hives.length === 0) {
    return (
      <div className="roof-plan-empty">
        <p>请导入蜂箱台账数据以查看屋顶平面图</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case HIVE_STATUS.CRITICAL: return '#ef4444';
      case HIVE_STATUS.AT_RISK: return '#f59e0b';
      case HIVE_STATUS.HEALTHY: return '#10b981';
      default: return '#6b7280';
    }
  };

  const getHighestRiskLevel = (assessment) => {
    if (!assessment || assessment.risks.length === 0) return null;
    
    if (assessment.highRiskCount > 0) return RISK_LEVELS.HIGH;
    if (assessment.mediumRiskCount > 0) return RISK_LEVELS.MEDIUM;
    if (assessment.lowRiskCount > 0) return RISK_LEVELS.LOW;
    
    return null;
  };

  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case RISK_LEVELS.HIGH: return '#ef4444';
      case RISK_LEVELS.MEDIUM: return '#f59e0b';
      case RISK_LEVELS.LOW: return '#10b981';
      default: return '#6b7280';
    }
  };

  const getRiskLevelBorderWidth = (riskLevel) => {
    switch (riskLevel) {
      case RISK_LEVELS.HIGH: return '4px';
      case RISK_LEVELS.MEDIUM: return '3px';
      case RISK_LEVELS.LOW: return '2px';
      default: return '2px';
    }
  };

  const getRiskLevelPulse = (riskLevel) => {
    switch (riskLevel) {
      case RISK_LEVELS.HIGH: return 'pulse-high';
      case RISK_LEVELS.MEDIUM: return 'pulse-medium';
      default: return '';
    }
  };

  const maxX = Math.max(...hives.map(h => h.x), 10);
  const maxY = Math.max(...hives.map(h => h.y), 10);
  const padding = 1;
  const scale = 50;

  const viewboxWidth = (maxX + padding * 2) * scale;
  const viewboxHeight = (maxY + padding * 2) * scale;

  return (
    <div className="roof-plan-container">
      <div className="roof-plan-header">
        <h3>屋顶蜂箱分布图</h3>
        <div className="roof-plan-legend">
          <div className="legend-item">
            <span className="legend-color critical"></span>
            <span>紧急处理</span>
          </div>
          <div className="legend-item">
            <span className="legend-color at-risk"></span>
            <span>需要关注</span>
          </div>
          <div className="legend-item">
            <span className="legend-color healthy"></span>
            <span>正常</span>
          </div>
        </div>
      </div>
      
      <div className="roof-plan-svg-container">
        <svg 
          viewBox={`0 0 ${viewboxWidth} ${viewboxHeight}`} 
          className="roof-plan-svg"
        >
          <defs>
            <pattern id="grid" width={scale} height={scale} patternUnits="userSpaceOnUse">
              <path 
                d={`M ${scale} 0 L 0 0 0 ${scale}`} 
                fill="none" 
                stroke="#e5e7eb" 
                strokeWidth="1"
              />
            </pattern>
          </defs>
          
          <rect 
            width="100%" 
            height="100%" 
            fill="url(#grid)" 
          />
          
          {hives.map(hive => {
            const assessment = riskAssessments.find(a => a.hiveId === hive.id);
            const status = assessment?.overallStatus || HIVE_STATUS.HEALTHY;
            const riskLevel = getHighestRiskLevel(assessment);
            const isSelected = selectedHive?.id === hive.id;
            
            const cx = (hive.x + padding) * scale;
            const cy = (hive.y + padding) * scale;
            const baseRadius = 20;
            const riskRadius = riskLevel === RISK_LEVELS.HIGH ? 28 : 
                               riskLevel === RISK_LEVELS.MEDIUM ? 25 : baseRadius;
            
            return (
              <g 
                key={hive.id} 
                className={`hive-node ${isSelected ? 'selected' : ''} ${getRiskLevelPulse(riskLevel)}`}
                onClick={() => onSelectHive(hive)}
                style={{ cursor: 'pointer' }}
              >
                {riskLevel && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={riskRadius}
                    fill="none"
                    stroke={getRiskLevelColor(riskLevel)}
                    strokeWidth={getRiskLevelBorderWidth(riskLevel)}
                    strokeDasharray={riskLevel === RISK_LEVELS.HIGH ? '5,5' : 'none'}
                    opacity="0.8"
                  />
                )}
                
                <circle
                  cx={cx}
                  cy={cy}
                  r={baseRadius}
                  fill={getStatusColor(status)}
                  stroke={isSelected ? '#3b82f6' : '#ffffff'}
                  strokeWidth={isSelected ? '3' : '2'}
                />
                
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {hive.id}
                </text>
                
                <text
                  x={cx}
                  y={cy + baseRadius + 15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#6b7280"
                  fontSize="10"
                  pointerEvents="none"
                >
                  ({hive.x}, {hive.y})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      
      <div className="roof-plan-stats">
        <p>总计: {hives.length} 个蜂箱</p>
        {selectedHive && (
          <p>已选择: 蜂箱 {selectedHive.id}</p>
        )}
      </div>
    </div>
  );
};

export default RoofPlan;
