import { exportInventory, exportFlow } from '../api';

function BookList({ books, locations, tags, filters, setFilters, loading, statusMap, onAdd, onBorrow, onReturn, onMarkLost, onCompensate, onViewDetail }) {
  const getStatusClass = (book) => {
    if (book.status === 'borrowed' && book.overdue_days > 0) {
      return 'status-overdue';
    }
    return `status-${book.status}`;
  };

  const getStatusText = (book) => {
    if (book.status === 'borrowed' && book.overdue_days > 0) {
      return `超期 ${book.overdue_days} 天`;
    }
    if (book.status === 'borrowed') {
      return `借阅中 - ${book.active_borrow?.resident_name || '未知'}`;
    }
    return statusMap[book.status] || book.status;
  };

  const availableBooks = books.filter(b => b.status === 'available').length;
  const borrowedBooks = books.filter(b => b.status === 'borrowed').length;
  const overdueBooks = books.filter(b => b.status === 'borrowed' && b.overdue_days > 0).length;
  const lostBooks = books.filter(b => b.status === 'lost').length;

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{availableBooks}</div>
          <div className="stat-label">可借阅</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{borrowedBooks}</div>
          <div className="stat-label">借阅中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#dc3545' }}>{overdueBooks}</div>
          <div className="stat-label">已超期</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{lostBooks}</div>
          <div className="stat-label">已丢失</div>
        </div>
      </div>

      <div className="section-header">
        <h2>图书列表</h2>
        <div className="export-buttons">
          <button className="btn btn-secondary" onClick={exportInventory}>
            📊 导出盘点表
          </button>
          <button className="btn btn-secondary" onClick={exportFlow}>
            📈 导出流转记录
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            ➕ 新增图书
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>按点位筛选</label>
          <select 
            value={filters.location_id}
            onChange={(e) => setFilters({ ...filters, location_id: e.target.value })}
          >
            <option value="">全部点位</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>按状态筛选</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="available">可借阅</option>
            <option value="borrowed">借阅中</option>
            <option value="lost">已丢失</option>
            <option value="compensated">已赔偿</option>
          </select>
        </div>
        <div className="filter-group">
          <label>按标签筛选</label>
          <select 
            value={filters.tag_id}
            onChange={(e) => setFilters({ ...filters, tag_id: e.target.value })}
          >
            <option value="">全部标签</option>
            {tags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="empty-state">
          <h3>暂无图书数据</h3>
          <p>点击"新增图书"添加第一本书</p>
        </div>
      ) : (
        <div className="book-list">
          {books.map(book => (
            <div key={book.id} className="book-item">
              <div className="book-header">
                <div>
                  <div className="book-title">{book.title}</div>
                  <div className="book-author">作者：{book.author || '未知'}</div>
                </div>
                <span className={`status-badge ${getStatusClass(book)}`}>
                  {getStatusText(book)}
                </span>
              </div>
              
              <div className="book-tags">
                {book.tags?.map(tag => (
                  <span key={tag.id} className="tag">{tag.name}</span>
                ))}
              </div>

              <div className="book-footer">
                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                  {book.current_location_name && `📍 当前位置：${book.current_location_name}`}
                  {book.active_borrow && `📅 应还日期：${book.active_borrow.expected_return_date?.split(' ')[0]}`}
                </div>
                <div className="book-actions">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => onViewDetail(book)}
                  >
                    查看详情
                  </button>
                  
                  {book.status === 'available' && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onBorrow(book)}
                    >
                      借阅
                    </button>
                  )}
                  
                  {book.status === 'borrowed' && (
                    <>
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => onReturn(book)}
                      >
                        归还
                      </button>
                      {book.overdue_days > 15 && (
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => onMarkLost(book)}
                        >
                          标记丢失
                        </button>
                      )}
                    </>
                  )}
                  
                  {book.status === 'lost' && (
                    <button 
                      className="btn btn-warning btn-sm"
                      onClick={() => onCompensate(book)}
                    >
                      赔偿登记
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default BookList;
