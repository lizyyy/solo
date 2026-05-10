import { useState, useEffect } from 'react';
import { getBookDetail } from '../api';

function BookDetail({ book: initialBook, actionMap, statusMap, onClose }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetail();
  }, [initialBook.id]);

  const loadDetail = async () => {
    try {
      const res = await getBookDetail(initialBook.id);
      setBook(res.data);
    } catch (err) {
      console.error('Failed to load book detail:', err);
      setBook(initialBook);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="loading">加载中...</div>
        </div>
      </div>
    );
  }

  if (!book) return null;

  const getStatusClass = () => {
    if (book.status === 'borrowed' && book.overdue_days > 0) {
      return 'status-overdue';
    }
    return `status-${book.status}`;
  };

  const buildRoute = () => {
    const route = [];
    
    if (book.current_location_name) {
      route.push({
        time: '当前位置',
        location: book.current_location_name,
        action: statusMap[book.status] || book.status
      });
    }

    (book.history || []).forEach(h => {
      if (h.to_location_name || h.from_location_name) {
        route.push({
          time: h.timestamp,
          location: h.to_location_name || h.from_location_name || '借阅中',
          action: actionMap[h.action] || h.action,
          resident: h.resident_name,
          notes: h.notes
        });
      }
    });

    return route;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="section-header">
          <h2>📖 {book.title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="detail-section">
          <h3>基本信息</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">书名</span>
              <span className="detail-value">{book.title}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">作者</span>
              <span className="detail-value">{book.author || '未知'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">ISBN</span>
              <span className="detail-value">{book.isbn || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">当前状态</span>
              <span className={`status-badge ${getStatusClass()}`}>
                {statusMap[book.status] || book.status}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">当前位置</span>
              <span className="detail-value">
                {book.current_location_name || (book.status === 'borrowed' ? '借阅中' : '-')}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">标签</span>
              <span className="detail-value">
                {book.tags?.map(t => t.name).join(', ') || '无'}
              </span>
            </div>
          </div>
        </div>

        {book.active_borrow && (
          <div className="detail-section">
            <h3>🔄 当前借阅</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">借阅人</span>
                <span className="detail-value">{book.active_borrow.resident_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">借阅地点</span>
                <span className="detail-value">{book.active_borrow.borrow_location_name || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">借阅日期</span>
                <span className="detail-value">{book.active_borrow.borrow_date?.split(' ')[0]}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">应还日期</span>
                <span className="detail-value">{book.active_borrow.expected_return_date?.split(' ')[0]}</span>
              </div>
              {book.overdue_days > 0 && (
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label" style={{ color: '#dc3545' }}>超期天数</span>
                  <span className="detail-value" style={{ color: '#dc3545', fontWeight: 'bold' }}>
                    {book.overdue_days} 天
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="detail-section">
          <h3>🗺️ 历史路线</h3>
          {book.history && book.history.length > 0 ? (
            <div className="route-timeline">
              {buildRoute().map((item, idx) => (
                <div key={idx} className="route-item">
                  <div className="route-time">{item.time}</div>
                  <div className="route-location">{item.location}</div>
                  <div className="route-action">
                    {item.action}
                    {item.resident && ` - ${item.resident}`}
                    {item.notes && ` (${item.notes})`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">暂无流转记录</div>
          )}
        </div>

        {book.borrow_records && book.borrow_records.length > 0 && (
          <div className="detail-section">
            <h3>📋 借阅记录</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>借阅人</th>
                  <th>借放点</th>
                  <th>归还点</th>
                  <th>借阅日期</th>
                  <th>归还日期</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {book.borrow_records.map(record => (
                  <tr key={record.id}>
                    <td>{record.resident_name}</td>
                    <td>{record.borrow_location_name}</td>
                    <td>{record.return_location_name || '-'}</td>
                    <td>{record.borrow_date?.split(' ')[0]}</td>
                    <td>{record.actual_return_date?.split(' ')[0] || '-'}</td>
                    <td>
                      <span className={`status-badge status-${record.status}`}>
                        {record.status === 'active' ? '进行中' : 
                         record.status === 'returned' ? '已归还' :
                         record.status === 'lost' ? '已丢失' : record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookDetail;
