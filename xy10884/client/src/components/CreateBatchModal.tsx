import React, { useState } from 'react';
import { DeviceGroupInfo } from '../types';

interface CreateBatchModalProps {
  deviceGroups: DeviceGroupInfo[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ deviceGroups, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [createdBy, setCreatedBy] = useState('admin');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [expiryThresholdDays, setExpiryThresholdDays] = useState(30);

  const handleGroupToggle = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter(g => g !== groupId));
    } else {
      setSelectedGroups([...selectedGroups, groupId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      createdBy,
      deviceGroups: selectedGroups,
      expiryThresholdDays
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>创建证书续期批次</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>批次名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：2024年Q2证书续期"
              required
            />
          </div>

          <div className="form-group">
            <label>操作人</label>
            <input
              type="text"
              value={createdBy}
              onChange={e => setCreatedBy(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>到期阈值（天）</label>
            <input
              type="number"
              value={expiryThresholdDays}
              onChange={e => setExpiryThresholdDays(Number(e.target.value))}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label>设备分组</label>
            <div className="checkbox-group">
              {deviceGroups.map(group => (
                <div key={group.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={group.id}
                    checked={selectedGroups.includes(group.id)}
                    onChange={() => handleGroupToggle(group.id)}
                  />
                  <label htmlFor={group.id}>{group.name}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={selectedGroups.length === 0}>
              创建批次
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBatchModal;