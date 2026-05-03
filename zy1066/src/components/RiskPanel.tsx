import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateRiskAssessment, calculateOverallRisk } from '../utils/riskCalculator';
import { DIFFICULTY_NAMES } from '../data/sampleData';

export function RiskPanel() {
  const { activeRoute, activeWall, wallRoutes, state } = useApp();

  const overallRisk = useMemo(() => {
    if (!activeWall) return null;
    return calculateOverallRisk(wallRoutes, activeWall, state.userProfile);
  }, [wallRoutes, activeWall, state.userProfile]);

  const currentRouteRisk = useMemo(() => {
    if (!activeRoute || !activeWall) return null;
    return calculateRiskAssessment(activeRoute, activeWall, state.userProfile);
  }, [activeRoute, activeWall, state.userProfile]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'danger': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'safe': return '#10b981';
      default: return '#64748b';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'danger': return '高风险';
      case 'warning': return '中等风险';
      case 'safe': return '安全';
      default: return '未知';
    }
  };

  return (
    <div className="panel-section">
      <h3 className="panel-title">风险评估</h3>

      {!activeRoute ? (
        <div className="panel-section">
          <h4 className="form-label" style={{ marginBottom: '8px' }}>整体风险概览</h4>
          
          {overallRisk && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">总线路</div>
                  <div className="stat-value">{wallRoutes.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">平均风险分</div>
                  <div className="stat-value">{overallRisk.avgRiskScore}</div>
                </div>
              </div>

              <div className="progress-bar" style={{ marginTop: '16px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, overallRisk.avgRiskScore)}%`,
                    backgroundColor: getRiskColor(
                      overallRisk.avgRiskScore >= 60 ? 'danger' :
                      overallRisk.avgRiskScore >= 30 ? 'warning' : 'safe'
                    ),
                  }}
                />
              </div>

              <div style={{ marginTop: '12px' }}>
                {Object.entries(overallRisk.byRisk).map(([level, count]) => (
                  count > 0 && (
                    <div key={level} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      fontSize: '0.8125rem'
                    }}>
                      <span style={{ color: getRiskColor(level) }}>
                        {getRiskLabel(level)}
                      </span>
                      <span>{count} 条</span>
                    </div>
                  )
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: '16px' }}>
            <p className="form-label">提示</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              选择一条线路查看详细风险评估
            </p>
          </div>
        </div>
      ) : (
        <>
          {currentRouteRisk && (
            <>
              <div className="panel-section">
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span className="form-label">当前线路: {activeRoute.name}</span>
                  <span 
                    className="difficulty-badge"
                    style={{ 
                      backgroundColor: `rgba(${getRiskColor(currentRouteRisk.overallRisk).replace('#', '')}, 0.2)`,
                      color: getRiskColor(currentRouteRisk.overallRisk)
                    }}
                  >
                    {getRiskLabel(currentRouteRisk.overallRisk)}
                  </span>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">难度</div>
                    <div className="stat-value">{DIFFICULTY_NAMES[activeRoute.difficulty]}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">风险分</div>
                    <div className="stat-value">{currentRouteRisk.riskScore}</div>
                  </div>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, currentRouteRisk.riskScore)}%`,
                      backgroundColor: getRiskColor(currentRouteRisk.overallRisk),
                    }}
                  />
                </div>
              </div>

              <div className="divider" />

              <div className="panel-section">
                <h4 className="form-label" style={{ marginBottom: '12px' }}>风险详情</h4>
                
                {currentRouteRisk.assessments.map((assessment, index) => (
                  <div 
                    key={index} 
                    className={`risk-alert ${assessment.level}`}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {assessment.level === 'danger' ? '🔴 ' : 
                       assessment.level === 'warning' ? '⚠️ ' : '✅ '}
                      {assessment.message}
                    </div>
                    {assessment.details && (
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', opacity: 0.8 }}>
                        {assessment.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="divider" />

              <div className="panel-section">
                <h4 className="form-label" style={{ marginBottom: '8px' }}>用户设置</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <p>身高: {state.userProfile.height}cm</p>
                  <p>臂展: {state.userProfile.armSpan}cm</p>
                  <p>技术等级: {DIFFICULTY_NAMES[state.userProfile.skillLevel]}</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
