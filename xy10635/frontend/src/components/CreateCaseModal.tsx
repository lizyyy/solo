import React, { useState } from 'react';
import { CASE_DOMAINS, PRIORITIES } from '../types';

interface CreateCaseModalProps {
  onClose: () => void;
  onCreate: (data: any) => void;
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    opposing_party: '',
    case_domain: '',
    priority: 'medium',
    created_by: '管理员'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>新建案件</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>案件编号</label>
            <input
              type="text"
              className="form-control"
              value={formData.case_number}
              onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
              placeholder="例如: CASE-2024-001"
              required
            />
          </div>

          <div className="form-group">
            <label>案件标题</label>
            <input
              type="text"
              className="form-control"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="请输入案件标题"
              required
            />
          </div>

          <div className="form-group">
            <label>对方主体</label>
            <input
              type="text"
              className="form-control"
              value={formData.opposing_party}
              onChange={(e) => setFormData({ ...formData, opposing_party: e.target.value })}
              placeholder="请输入对方主体名称"
              required
            />
          </div>

          <div className="form-group">
            <label>案件领域</label>
            <select
              className="form-control"
              value={formData.case_domain}
              onChange={(e) => setFormData({ ...formData, case_domain: e.target.value })}
              required
            >
              <option value="">请选择领域</option>
              {CASE_DOMAINS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>优先级</label>
            <select
              className="form-control"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2" style={{ marginTop: '20px' }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCaseModal;
