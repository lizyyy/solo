import { useState, FormEvent } from 'react';

interface CreateRequestModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const CreateRequestModal = ({ onClose, onSubmit }: CreateRequestModalProps) => {
  const [formData, setFormData] = useState({
    lab_space_id: 1,
    snapshot_id: 1,
    requested_by: 'TA001',
    requested_by_name: '李助教',
    reason: ''
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建重置申请</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>实验空间 ID</label>
            <input 
              type="number"
              value={formData.lab_space_id}
              onChange={e => setFormData({ ...formData, lab_space_id: parseInt(e.target.value) })}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label>快照 ID</label>
            <input 
              type="number"
              value={formData.snapshot_id}
              onChange={e => setFormData({ ...formData, snapshot_id: parseInt(e.target.value) })}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label>申请人 ID</label>
            <input 
              type="text"
              value={formData.requested_by}
              onChange={e => setFormData({ ...formData, requested_by: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>申请人姓名</label>
            <input 
              type="text"
              value={formData.requested_by_name}
              onChange={e => setFormData({ ...formData, requested_by_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>重置原因</label>
            <textarea 
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              placeholder="请说明需要重置实验环境的原因..."
              rows={3}
            />
          </div>

          <div className="btn-group">
            <button type="submit" className="btn btn-primary">
              创建申请
            </button>
            <button type="button" className="btn btn-danger" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRequestModal;