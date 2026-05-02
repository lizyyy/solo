import React from 'react';
import { useAppStore } from '../store';
import { formatTimestamp } from '../utils/dataParser';

export const AlertPanel: React.FC = () => {
  const {
    alerts,
    setSelectedSensor,
    workOrders,
    inspectionSuggestions,
  } = useAppStore();

  const getPriorityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
      case 'error':
        return { bg: '#fff7ed', border: '#ea580c', text: '#9a3412' };
      case 'warning':
        return { bg: '#fefce8', border: '#ca8a04', text: '#854d0e' };
      default:
        return { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'continuous_threshold':
        return '连续超阈';
      case 'sensor_offline':
        return '传感器离线';
      case 'repeated_dispatch':
        return '重复派单';
      default:
        return type;
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '严重';
      case 'error':
        return '错误';
      case 'warning':
        return '警告';
      default:
        return severity;
    }
  };

  const handleAlertClick = (alert: ReturnType<typeof useAppStore>['alerts'][0]) => {
    if (alert.sensorId) {
      setSelectedSensor(alert.sensorId);
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const errorCount = alerts.filter((a) => a.severity === 'error').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="alert-panel">
      <div className="panel-header">
        <h3>告警中心</h3>
        <div className="alert-summary">
          {criticalCount > 0 && (
            <span className="badge critical">{criticalCount} 严重</span>
          )}
          {errorCount > 0 && (
            <span className="badge error">{errorCount} 错误</span>
          )}
          {warningCount > 0 && (
            <span className="badge warning">{warningCount} 警告</span>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state">
          <p>暂无告警</p>
          <p className="hint">系统运行正常</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts
            .sort((a, b) => {
              const severityWeight = { critical: 3, error: 2, warning: 1 };
              const severityDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
              if (severityDiff !== 0) return severityDiff;
              return b.timestamp - a.timestamp;
            })
            .map((alert) => {
              const colors = getPriorityColor(alert.severity);
              const relatedOrders = alert.relatedWorkOrders
                ? workOrders.filter((o) => alert.relatedWorkOrders?.includes(o.id))
                : [];

              return (
                <div
                  key={alert.id}
                  className="alert-item"
                  style={{
                    backgroundColor: colors.bg,
                    borderLeftColor: colors.border,
                  }}
                  onClick={() => handleAlertClick(alert)}
                >
                  <div className="alert-header">
                    <span
                      className="alert-type"
                      style={{
                        backgroundColor: colors.border,
                        color: 'white',
                      }}
                    >
                      {getAlertTypeLabel(alert.type)}
                    </span>
                    <span className="alert-severity" style={{ color: colors.text }}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </div>
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-desc">{alert.description}</div>
                  
                  {relatedOrders.length > 0 && (
                    <div className="related-workorders">
                      <span className="label">关联工单:</span>
                      {relatedOrders.map((order) => (
                        <span key={order.id} className="workorder-tag">
                          {order.id}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="alert-meta">
                    <span className="time">{formatTimestamp(alert.timestamp)}</span>
                    {alert.sensorId && (
                      <span className="sensor-link">点击查看传感器 →</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {inspectionSuggestions.length > 0 && (
        <div className="suggestions-section">
          <h4>巡检建议</h4>
          <div className="suggestions-list">
            {inspectionSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="suggestion-item"
                style={{
                  borderLeftColor: suggestion.priority === 'high' ? '#dc2626' : suggestion.priority === 'medium' ? '#ea580c' : '#6b7280',
                }}
              >
                <div className="suggestion-header">
                  <span className={`priority ${suggestion.priority}`}>
                    {suggestion.priority === 'high' ? '高优先级' : suggestion.priority === 'medium' ? '中优先级' : '低优先级'}
                  </span>
                  <span className="issue-type">{suggestion.issueType}</span>
                </div>
                <div className="suggestion-text">{suggestion.suggestion}</div>
                <div className="suggestion-location">
                  位置: {suggestion.floorId} / {suggestion.zoneId}
                  {suggestion.sensorId && ` / ${suggestion.sensorId}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
