import React, { useState } from 'react';
import { CASE_DOMAINS } from '../types';

interface CreateLawyerModalProps {
  onClose: () => void;
  onCreate: (data: any) => void;
}

const CreateLawyerModal: React.FC<CreateLawyerModalProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    capacity: 5
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>添加律师</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>律师姓名</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="请输入律师姓名"
              required
            />
          </div>

          <div className="form-group">
            <label>专业领域</label>
            <select
              className="form-control"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              required
            >
              <option value="">请选择专业领域</option>
              {CASE_DOMAINS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>案件容量</label>
            <input
              type="number"
              className="form-control"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
              min="1"
              max="20"
            />
          </div>

          <div className="flex gap-2" style={{ marginTop: '20px' }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLawyerModal;
