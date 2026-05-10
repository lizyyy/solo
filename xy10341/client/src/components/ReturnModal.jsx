import { useState, useEffect } from 'react';
import { returnBook, getBookDetail } from '../api';

function ReturnModal({ book, locations, onClose, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    return_location_id: ''
  });
  const [bookDetail, setBookDetail] = useState(null);

  useEffect(() => {
    loadDetail();
  }, [book.id]);

  const loadDetail = async () => {
    try {
      const res = await getBookDetail(book.id);
      setBookDetail(res.data);
      if (res.data.active_borrow) {
        setFormData({ return_location_id: res.data.active_borrow.borrow_location_id || '' });
      }
    } catch (err) {
      console.error('Failed to load book detail:', err);
    }
  };

  const isCrossLocation = bookDetail?.active_borrow && 
    formData.return_location_id &&
    parseInt(bookDetail.active_borrow.borrow_location_id) !== parseInt(formData.return_location_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.return_location_id) {
      onError('请选择归还地点');
      return;
    }

    try {
      const res = await returnBook({
        book_id: book.id,
        return_location_id: parseInt(formData.return_location_id)
      });
      onSuccess(res.data.is_cross_location);
    } catch (err) {
      onError(err.response?.data?.error || '归还登记失败');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>📚 归还登记</h2>
        <div className="alert alert-success">
          正在归还：<strong>{book.title}</strong>
        </div>
        
        {bookDetail?.active_borrow && (
          <div className="detail-section" style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>借阅人：</strong>{bookDetail.active_borrow.resident_name}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>借放点：</strong>{bookDetail.active_borrow.borrow_location_name}
            </div>
            <div>
              <strong>借阅日期：</strong>{bookDetail.active_borrow.borrow_date?.split(' ')[0]}
            </div>
            {bookDetail.overdue_days > 0 && (
              <div style={{ marginTop: '8px', color: '#dc3545', fontWeight: 'bold' }}>
                ⚠️ 已超期 {bookDetail.overdue_days} 天
              </div>
            )}
          </div>
        )}

        {isCrossLocation && (
          <div className="alert alert-warning">
            📍 检测到换点归还，系统将自动记录流转路径
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>归还地点 *</label>
            <select
              value={formData.return_location_id}
              onChange={(e) => setFormData({ ...formData, return_location_id: e.target.value })}
            >
              <option value="">请选择漂流点</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-success">
              {isCrossLocation ? '确认换点归还' : '确认归还'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReturnModal;
