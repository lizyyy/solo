import { useState } from 'react';
import { compensate } from '../api';

function CompensateModal({ book, residents, onClose, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    resident_id: '',
    amount: '',
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.resident_id || !formData.amount) {
      onError('请选择赔偿人和填写赔偿金额');
      return;
    }

    try {
      await compensate({
        book_id: book.id,
        resident_id: parseInt(formData.resident_id),
        amount: parseFloat(formData.amount),
        notes: formData.notes
      });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.error || '赔偿登记失败');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>💰 赔偿登记</h2>
        <div className="alert alert-warning">
          正在处理丢失赔偿：<strong>{book.title}</strong>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>赔偿人 *</label>
            <select
              value={formData.resident_id}
              onChange={(e) => setFormData({ ...formData, resident_id: e.target.value })}
            >
              <option value="">请选择居民</option>
              {residents.map(res => (
                <option key={res.id} value={res.id}>{res.name} ({res.phone})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>赔偿金额 (元) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="请输入赔偿金额"
            />
          </div>
          <div className="form-group">
            <label>备注</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="赔偿说明（选填）"
              rows="3"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-warning">确认赔偿</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CompensateModal;
