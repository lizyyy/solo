import React, { useState } from 'react';

interface ExportModalProps {
  onClose: () => void;
  onExport: (params: any) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport }) => {
  const [formData, setFormData] = useState({
    responsible_person: '',
    start_date: '',
    end_date: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>导出案件</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>责任人</label>
            <input
              type="text"
              className="form-control"
              value={formData.responsible_person}
              onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
              placeholder="请输入责任人名称（可选）"
            />
          </div>

          <div className="form-group">
            <label>开始日期</label>
            <input
              type="date"
              className="form-control"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>结束日期</label>
            <input
              type="date"
              className="form-control"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div className="flex gap-2" style={{ marginTop: '20px' }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              导出
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportModal;
