function OverdueList({ overdueList, loading, onReturn, onMarkLost }) {
  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <>
      <div className="section-header">
        <h2>⏰ 超期提醒</h2>
      </div>

      {overdueList.length === 0 ? (
        <div className="empty-state">
          <h3>🎉 没有超期图书</h3>
          <p>所有借阅都在正常归还期内</p>
        </div>
      ) : (
        <>
          <div className="alert alert-warning">
            ⚠️ 共有 <strong>{overdueList.length}</strong> 本图书已超期，请及时联系居民归还
          </div>
          
          <table className="table">
            <thead>
              <tr>
                <th>图书名称</th>
                <th>借阅居民</th>
                <th>联系电话</th>
                <th>借放点</th>
                <th>借阅日期</th>
                <th>应还日期</th>
                <th>超期天数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {overdueList.map(record => (
                <tr key={record.id}>
                  <td><strong>{record.book_title}</strong></td>
                  <td>{record.resident_name}</td>
                  <td>{record.resident_phone}</td>
                  <td>{record.borrow_location_name}</td>
                  <td>{record.borrow_date?.split(' ')[0]}</td>
                  <td>{record.expected_return_date?.split(' ')[0]}</td>
                  <td>
                    <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                      {record.overdue_days} 天
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => onReturn({ id: record.book_id, title: record.book_title, active_borrow: record })}
                      >
                        归还
                      </button>
                      {record.overdue_days > 15 && (
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => onMarkLost({ id: record.book_id, active_borrow: record })}
                        >
                          标记丢失
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

export default OverdueList;
