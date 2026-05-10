import { useState } from 'react';
import { borrowBook } from '../api';

function BorrowModal({ book, locations, residents, onClose, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    resident_id: '',
    borrow_location_id: book.current_location_id || '',
    borrow_days: 30
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.resident_id || !formData.borrow_location_id) {
      onError('请选择借阅人和借阅地点');
      return;
    }

    try {
      await borrowBook({
        book_id: book.id,
        resident_id: parseInt(formData.resident_id),
        borrow_location_id: parseInt(formData.borrow_location_id),
        borrow_days: parseInt(formData.borrow_days)
      });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.error || '借阅登记失败');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>📖 借阅登记</h2>
        <div className="alert alert-warning">
          正在借阅：<strong>{book.title}</strong>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>借阅人 *</label>
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
            <label>借阅地点 *</label>
            <select
              value={formData.borrow_location_id}
              onChange={(e) => setFormData({ ...formData, borrow_location_id: e.target.value })}
            >
              <option value="">请选择漂流点</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>借阅天数</label>
            <select
              value={formData.borrow_days}
              onChange={(e) => setFormData({ ...formData, borrow_days: e.target.value })}
            >
              <option value={7}>7 天</option>
              <option value={14}>14 天</option>
              <option value={30}>30 天（默认）</option>
              <option value={60}>60 天</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">确认借阅</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BorrowModal;
