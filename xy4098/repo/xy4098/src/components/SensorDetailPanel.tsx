import React from 'react';
import { useAppStore } from '../store';
import { formatTimestamp } from '../utils/dataParser';
import type { Sensor, WorkOrder, Alert } from '../types';

export const SensorDetailPanel: React.FC = () => {
  const {
    selectedSensorId,
    setSelectedSensor,
    sensors,
    workOrders,
    thresholds,
    currentTime,
    alerts,
    getSensorReadingAtTime,
  } = useAppStore();

  const sensor = sensors.find((s) => s.id === selectedSensorId);

  if (!sensor) {
    return (
      <div className="sensor-detail-panel empty">
        <div className="empty-state">
          <p>请点击3D场景中的传感器点位</p>
          <p className="hint">或从告警列表中选择</p>
        </div>
      </div>
    );
  }

  const currentReading = getSensorReadingAtTime(sensor.id, currentTime);
  const sensorWorkOrders = workOrders.filter((o) => o.sensorId === sensor.id);
  const sensorAlerts = alerts.filter((a) => a.sensorId === sensor.id);

  const getTemperatureStatus = (temp: number) => {
    if (temp < thresholds.temperatureMin) return 'low';
    if (temp > thresholds.temperatureMax) return 'high';
    return 'normal';
  };

  const getHumidityStatus = (humidity: number) => {
    if (humidity < thresholds.humidityMin) return 'low';
    if (humidity > thresholds.humidityMax) return 'high';
    return 'normal';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'high':
        return '#dc2626';
      case 'low':
        return '#2563eb';
      default:
        return '#16a34a';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#ca8a04';
      default:
        return '#6b7280';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return '待处理';
      case 'in_progress':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  return (
    <div className="sensor-detail-panel">
      <div className="panel-header">
        <h3>传感器详情</h3>
        <button
          className="close-btn"
          onClick={() => setSelectedSensor(null)}
        >
          ✕
        </button>
      </div>

      <div className="sensor-info">
        <div className="info-row">
          <span className="label">名称:</span>
          <span className="value">{sensor.name}</span>
        </div>
        <div className="info-row">
          <span className="label">ID:</span>
          <span className="value code">{sensor.id}</span>
        </div>
        <div className="info-row">
          <span className="label">楼层:</span>
          <span className="value">{sensor.floorId}</span>
        </div>
        <div className="info-row">
          <span className="label">区域:</span>
          <span className="value">{sensor.zoneId}</span>
        </div>
        <div className="info-row">
          <span className="label">坐标:</span>
          <span className="value">({sensor.x.toFixed(1)}, {sensor.y.toFixed(1)})</span>
        </div>
      </div>

      {currentReading && (
        <div className="current-readings">
          <h4>当前读数</h4>
          <div className="readings-grid">
            <div 
              className="reading-card"
              style={{ borderLeftColor: getStatusColor(getTemperatureStatus(currentReading.temperature)) }}
            >
              <div className="reading-label">温度</div>
              <div className="reading-value">
                {currentReading.temperature.toFixed(1)}°C
              </div>
              <div className="reading-range">
                范围: {thresholds.temperatureMin}°C - {thresholds.temperatureMax}°C
              </div>
            </div>
            <div 
              className="reading-card"
              style={{ borderLeftColor: getStatusColor(getHumidityStatus(currentReading.humidity)) }}
            >
              <div className="reading-label">湿度</div>
              <div className="reading-value">
                {currentReading.humidity.toFixed(1)}%
              </div>
              <div className="reading-range">
                范围: {thresholds.humidityMin}% - {thresholds.humidityMax}%
              </div>
            </div>
            <div 
              className="reading-card"
              style={{ borderLeftColor: currentReading.isOnline ? '#16a34a' : '#dc2626' }}
            >
              <div className="reading-label">在线状态</div>
              <div className="reading-value">
                {currentReading.isOnline ? '✓ 在线' : '✗ 离线'}
              </div>
              <div className="reading-range">
                最后更新: {formatTimestamp(currentTime, 'time')}
              </div>
            </div>
          </div>
        </div>
      )}

      {sensorAlerts.length > 0 && (
        <div className="alerts-section">
          <h4>关联告警 ({sensorAlerts.length})</h4>
          <div className="alerts-list">
            {sensorAlerts.map((alert) => (
              <div
                key={alert.id}
                className="alert-item"
                style={{ borderLeftColor: getPriorityColor(alert.severity) }}
              >
                <div className="alert-title">{alert.title}</div>
                <div className="alert-desc">{alert.description}</div>
                <div className="alert-meta">
                  <span className="severity" style={{ color: getPriorityColor(alert.severity) }}>
                    {alert.severity === 'critical' ? '严重' : alert.severity === 'error' ? '错误' : '警告'}
                  </span>
                  <span className="time">{formatTimestamp(alert.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sensorWorkOrders.length > 0 && (
        <div className="workorders-section">
          <h4>关联工单 ({sensorWorkOrders.length})</h4>
          <div className="workorders-list">
            {sensorWorkOrders.map((order) => (
              <div
                key={order.id}
                className="workorder-item"
                style={{ borderLeftColor: getPriorityColor(order.priority) }}
              >
                <div className="order-header">
                  <span className="order-id">{order.id}</span>
                  <span className="order-status">{getStatusBadge(order.status)}</span>
                </div>
                <div className="order-title">{order.title}</div>
                <div className="order-desc">{order.description}</div>
                <div className="order-meta">
                  <span className="assignee">指派给: {order.assignedTo}</span>
                  <span className="time">{formatTimestamp(order.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sensor.readings.length > 0 && (
        <div className="history-section">
          <h4>历史读数 (最近5条)</h4>
          <div className="history-table">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>温度</th>
                  <th>湿度</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {sensor.readings
                  .slice(-5)
                  .reverse()
                  .map((reading, idx) => (
                    <tr key={idx}>
                      <td>{formatTimestamp(reading.timestamp, 'time')}</td>
                      <td style={{ color: getStatusColor(getTemperatureStatus(reading.temperature)) }}>
                        {reading.temperature.toFixed(1)}°C
                      </td>
                      <td style={{ color: getStatusColor(getHumidityStatus(reading.humidity)) }}>
                        {reading.humidity.toFixed(1)}%
                      </td>
                      <td>
                        <span className={reading.isOnline ? 'status-online' : 'status-offline'}>
                          {reading.isOnline ? '在线' : '离线'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
