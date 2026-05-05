import React from 'react';
import { HIVE_STATUS, RISK_TYPES } from '../models';
import './RiskDashboard.css';

const RiskDashboard = ({ hives, riskAssessments, onSelectHive }) => {
  const totalHives = hives.length;
  
  const criticalCount = riskAssessments.filter(a => a.overallStatus === HIVE_STATUS.CRITICAL).length;
  const atRiskCount = riskAssessments.filter(a => a.overallStatus === HIVE_STATUS.AT_RISK).length;
  const healthyCount = riskAssessments.filter(a => a.overallStatus === HIVE_STATUS.HEALTHY).length;
  
  const highRiskCount = riskAssessments.reduce((sum, a) => sum + a.highRiskCount, 0);
  const mediumRiskCount = riskAssessments.reduce((sum, a) => sum + a.mediumRiskCount, 0);
  const lowRiskCount = riskAssessments.reduce((sum, a) => sum + a.lowRiskCount, 0);

  const getRiskCountByType = (riskType) => {
    return riskAssessments.reduce((count, assessment) => {
      return count + assessment.risks.filter(r => r.type === riskType).length;
    }, 0);
  };

  const overheatingCount = getRiskCountByType(RISK_TYPES.OVERHEATING);
  const waterShortageCount = getRiskCountByType(RISK_TYPES.WATER_SHORTAGE);
  const queenAbnormalityCount = getRiskCountByType(RISK_TYPES.QUEEN_ABNORMALITY);
  const robbingRiskCount = getRiskCountByType(RISK_TYPES.ROBBING_RISK);

  const getCriticalHives = () => {
    return hives.filter(hive => {
      const assessment = riskAssessments.find(a => a.hiveId === hive.id);
      return assessment && assessment.overallStatus === HIVE_STATUS.CRITICAL;
    });
  };

  const getAtRiskHives = () => {
    return hives.filter(hive => {
      const assessment = riskAssessments.find(a => a.hiveId === hive.id);
      return assessment && assessment.overallStatus === HIVE_STATUS.AT_RISK;
    });
  };

  if (totalHives === 0) {
    return (
      <div className="risk-dashboard-empty">
        <p>导入数据后即可查看风险统计</p>
      </div>
    );
  }

  return (
    <div className="risk-dashboard-container">
      <h3 className="dashboard-title">风险概览</h3>
      
      <div className="stats-grid">
        <div className="stat-card critical">
          <div className="stat-icon">🚨</div>
          <div className="stat-info">
            <span className="stat-value">{criticalCount}</span>
            <span className="stat-label">紧急处理</span>
          </div>
        </div>
        
        <div className="stat-card at-risk">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <span className="stat-value">{atRiskCount}</span>
            <span className="stat-label">需要关注</span>
          </div>
        </div>
        
        <div className="stat-card healthy">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <span className="stat-value">{healthyCount}</span>
            <span className="stat-label">正常蜂群</span>
          </div>
        </div>
        
        <div className="stat-card total">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-value">{totalHives}</span>
            <span className="stat-label">总蜂箱数</span>
          </div>
        </div>
      </div>

      <div className="risk-breakdown">
        <h4>风险类型分布</h4>
        <div className="risk-type-grid">
          <div className="risk-type-item">
            <span className="risk-type-icon">🔥</span>
            <span className="risk-type-name">过热风险</span>
            <span className="risk-type-count">{overheatingCount}</span>
          </div>
          <div className="risk-type-item">
            <span className="risk-type-icon">💧</span>
            <span className="risk-type-name">缺水风险</span>
            <span className="risk-type-count">{waterShortageCount}</span>
          </div>
          <div className="risk-type-item">
            <span className="risk-type-icon">👑</span>
            <span className="risk-type-name">蜂王异常</span>
            <span className="risk-type-count">{queenAbnormalityCount}</span>
          </div>
          <div className="risk-type-item">
            <span className="risk-type-icon">🐝</span>
            <span className="risk-type-name">盗蜂风险</span>
            <span className="risk-type-count">{robbingRiskCount}</span>
          </div>
        </div>
      </div>

      <div className="risk-levels">
        <h4>风险等级统计</h4>
        <div className="level-bars">
          <div className="level-bar-item">
            <div className="level-header">
              <span className="level-dot high"></span>
              <span className="level-name">高风险</span>
              <span className="level-count">{highRiskCount}</span>
            </div>
            <div className="level-bar">
              <div 
                className="level-fill high"
                style={{ 
                  width: totalHives > 0 ? `${(highRiskCount / (highRiskCount + mediumRiskCount + lowRiskCount || 1)) * 100}%` : '0%' 
                }}
              ></div>
            </div>
          </div>
          
          <div className="level-bar-item">
            <div className="level-header">
              <span className="level-dot medium"></span>
              <span className="level-name">中风险</span>
              <span className="level-count">{mediumRiskCount}</span>
            </div>
            <div className="level-bar">
              <div 
                className="level-fill medium"
                style={{ 
                  width: totalHives > 0 ? `${(mediumRiskCount / (highRiskCount + mediumRiskCount + lowRiskCount || 1)) * 100}%` : '0%' 
                }}
              ></div>
            </div>
          </div>
          
          <div className="level-bar-item">
            <div className="level-header">
              <span className="level-dot low"></span>
              <span className="level-name">低风险</span>
              <span className="level-count">{lowRiskCount}</span>
            </div>
            <div className="level-bar">
              <div 
                className="level-fill low"
                style={{ 
                  width: totalHives > 0 ? `${(lowRiskCount / (highRiskCount + mediumRiskCount + lowRiskCount || 1)) * 100}%` : '0%' 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {criticalCount > 0 && (
        <div className="critical-alert-section">
          <h4>🚨 需要紧急处理的蜂箱</h4>
          <div className="hive-list">
            {getCriticalHives().map(hive => {
              const assessment = riskAssessments.find(a => a.hiveId === hive.id);
              return (
                <div 
                  key={hive.id} 
                  className="hive-list-item critical"
                  onClick={() => onSelectHive(hive)}
                >
                  <span className="hive-id">蜂箱 {hive.id}</span>
                  <span className="hive-risks">{assessment?.riskCount || 0} 项风险</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {atRiskCount > 0 && (
        <div className="at-risk-section">
          <h4>⚠️ 需要关注的蜂箱</h4>
          <div className="hive-list">
            {getAtRiskHives().slice(0, 5).map(hive => {
              const assessment = riskAssessments.find(a => a.hiveId === hive.id);
              return (
                <div 
                  key={hive.id} 
                  className="hive-list-item at-risk"
                  onClick={() => onSelectHive(hive)}
                >
                  <span className="hive-id">蜂箱 {hive.id}</span>
                  <span className="hive-risks">{assessment?.riskCount || 0} 项风险</span>
                </div>
              );
            })}
            {atRiskCount > 5 && (
              <div className="more-hives">还有 {atRiskCount - 5} 个蜂箱需要关注...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskDashboard;
