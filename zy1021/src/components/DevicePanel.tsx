import React from 'react';
import { DeviceState, InspectionItem } from '../types';
import { useAppContext } from '../context/AppContext';
import { formatTimestamp } from '../utils';
import './DevicePanel.css';

interface DevicePanelProps {
  device: DeviceState;
}

const fieldNames: Record<string, string> = {
  riskLevel: '风险等级',
  status: '处理状态',
  notes: '备注',
  photoPlaceholder: '照片备注'
};

const riskLevelOptions = [
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' }
];

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'completed', label: '已完成' }
];

const getRiskLevelColor = (level: string) => {
  switch (level) {
    case 'low':
      return '#10b981';
    case 'medium':
      return '#f59e0b';
    case 'high':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return '#6b7280';
    case 'in_progress':
      return '#3b82f6';
    case 'completed':
      return '#10b981';
    default:
      return '#6b7280';
  }
};

export const DevicePanel: React.FC<DevicePanelProps> = ({ device }) => {
  const { toggleDeviceOnline, updateFormField, syncDevice } = useAppContext();

  const handleFieldChange = (itemId: string, field: keyof InspectionItem, newValue: unknown) => {
    updateFormField(device.id, itemId, field, newValue);
  };

  const handleSync = () => {
    syncDevice(device.id);
  };

  const handleToggleOnline = () => {
    toggleDeviceOnline(device.id);
  };

  return (
    <div className={`device-panel ${device.isOnline ? 'online' : 'offline'}`}>
      <div className="device-header">
        <div className="device-info">
          <h3>{device.name}</h3>
          <div className="device-status">
            <span className={`status-indicator ${device.isOnline ? 'online' : 'offline'}`}></span>
            <span>{device.isOnline ? '在线' : '离线'}</span>
          </div>
        </div>
        <div className="device-controls">
          <div className="version-info">
            <span>本地版本: v{device.localVersion}</span>
          </div>
          <button
            className={`control-btn toggle-btn ${device.isOnline ? 'online' : 'offline'}`}
            onClick={handleToggleOnline}
          >
            {device.isOnline ? '断开网络' : '连接网络'}
          </button>
          <button
            className={`control-btn sync-btn ${!device.isOnline || device.pendingChanges.length === 0 ? 'disabled' : ''}`}
            onClick={handleSync}
            disabled={!device.isOnline || device.pendingChanges.length === 0}
          >
            同步 ({device.pendingChanges.length})
          </button>
        </div>
      </div>

      <div className="device-content">
        <div className="form-section">
          <h4>{device.localForm.title}</h4>
          <div className="inspection-items">
            {device.localForm.items.map((item) => (
              <div key={item.id} className="inspection-item">
                <div className="item-header">
                  <h5>{item.name}</h5>
                  <div className="item-meta">
                    <span>最后修改: {item.lastModifiedBy}</span>
                    <span>{formatTimestamp(item.lastModifiedAt)}</span>
                  </div>
                </div>

                <div className="item-fields">
                  <div className="field-group">
                    <label>风险等级</label>
                    <select
                      value={item.riskLevel}
                      onChange={(e) => handleFieldChange(item.id, 'riskLevel', e.target.value)}
                      style={{ borderColor: getRiskLevelColor(item.riskLevel) }}
                    >
                      {riskLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label>处理状态</label>
                    <select
                      value={item.status}
                      onChange={(e) => handleFieldChange(item.id, 'status', e.target.value)}
                      style={{ borderColor: getStatusColor(item.status) }}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group full-width">
                    <label>备注</label>
                    <textarea
                      value={item.notes}
                      onChange={(e) => handleFieldChange(item.id, 'notes', e.target.value)}
                      placeholder="输入备注信息..."
                    />
                  </div>

                  <div className="field-group full-width">
                    <label>照片备注</label>
                    <input
                      type="text"
                      value={item.photoPlaceholder}
                      onChange={(e) => handleFieldChange(item.id, 'photoPlaceholder', e.target.value)}
                      placeholder="输入照片描述（如：设备正面照、异常位置图等）..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {device.pendingChanges.length > 0 && (
          <div className="pending-changes-section">
            <h4>待同步更改 ({device.pendingChanges.length})</h4>
            <div className="pending-changes-list">
              {device.pendingChanges.map((change, index) => (
                <div key={change.id} className="pending-change-item">
                  <div className="change-index">#{index + 1}</div>
                  <div className="change-details">
                    <div className="change-field">
                      字段: {fieldNames[change.field] || change.field}
                    </div>
                    <div className="change-values">
                      <span className="old-value">{String(change.oldValue) || '(空)'}</span>
                      <span className="arrow">→</span>
                      <span className="new-value">{String(change.newValue) || '(空)'}</span>
                    </div>
                    <div className="change-meta">
                      <span>基于版本: v{change.version}</span>
                      <span>{formatTimestamp(change.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
