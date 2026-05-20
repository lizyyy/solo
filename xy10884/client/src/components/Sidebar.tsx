import React from 'react';
import { DeviceGroupInfo } from '../types';

interface SidebarProps {
  deviceGroups: DeviceGroupInfo[];
  selectedGroups: string[];
  onGroupChange: (groups: string[]) => void;
  expiryThreshold: number | null;
  onExpiryThresholdChange: (days: number | null) => void;
}

const expiryOptions = [
  { value: 7, label: '7天内到期' },
  { value: 15, label: '15天内到期' },
  { value: 30, label: '30天内到期' },
  { value: 60, label: '60天内到期' },
  { value: 90, label: '90天内到期' },
];

const Sidebar: React.FC<SidebarProps> = ({ 
  deviceGroups, 
  selectedGroups, 
  onGroupChange,
  expiryThreshold,
  onExpiryThresholdChange
}) => {
  const handleGroupToggle = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      onGroupChange(selectedGroups.filter(g => g !== groupId));
    } else {
      onGroupChange([...selectedGroups, groupId]);
    }
  };

  return (
    <div className="sidebar">
      <h2>🔐 证书续期编排</h2>
      
      <div className="filter-section">
        <h3>按设备分组筛选</h3>
        {deviceGroups.map(group => (
          <div
            key={group.id}
            className={`filter-item ${selectedGroups.includes(group.id) ? 'active' : ''}`}
            onClick={() => handleGroupToggle(group.id)}
          >
            <input
              type="checkbox"
              checked={selectedGroups.includes(group.id)}
              onChange={() => {}}
            />
            <span>{group.name}</span>
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>({group.count})</span>
          </div>
        ))}
      </div>

      <div className="filter-section">
        <h3>按到期时间筛选</h3>
        {expiryOptions.map(option => (
          <div
            key={option.value}
            className={`filter-item ${expiryThreshold === option.value ? 'active' : ''}`}
            onClick={() => onExpiryThresholdChange(expiryThreshold === option.value ? null : option.value)}
          >
            <input
              type="radio"
              checked={expiryThreshold === option.value}
              onChange={() => {}}
            />
            <span>{option.label}</span>
          </div>
        ))}
        {expiryThreshold && (
          <div 
            className="filter-item"
            onClick={() => onExpiryThresholdChange(null)}
            style={{ marginTop: '8px', color: '#94a3b8' }}
          >
            <span>✕ 清除时间筛选</span>
          </div>
        )}
      </div>

      <div className="filter-section">
        <h3>操作指南</h3>
        <div style={{ padding: '8px 12px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
          <p>• 点击批次查看详情</p>
          <p>• 在详情页可模拟签发回调</p>
          <p>• 对离线设备可发起补偿</p>
          <p>• 查看复盘报告了解整体情况</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;