import React, { useState, useEffect } from 'react';

function CollaborationLogs({ api }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/collaboration-logs');
      setLogs(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = !filterAction || log.action === filterAction;
    return matchSearch && matchAction;
  });

  const actionTypes = [...new Set(logs.map(l => l.action))];

  const getLogClass = (action) => {
    if (action.includes('error') || action.includes('blocked') || action.includes('conflict')) return 'log-entry-error';
    if (action.includes('success') || action.includes('resolved')) return 'log-entry-success';
    if (action.includes('warning')) return 'log-entry-warning';
    return 'log-entry-info';
  };

  return (
    <div>
      <div className="flex flex-between align-center" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">📋 全部协作日志</h2>
        <button className="btn retry-btn" onClick={fetchLogs}>
          🔄 刷新
        </button>
      </div>

      <div className="card">
        <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
          <input 
            type="text" 
            className="input"
            placeholder="🔍 搜索日志内容..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select 
            className="input"
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            <option value="">全部动作类型</option>
            {actionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="spinner"></span> 加载中...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
            没有找到匹配的日志
          </div>
        ) : (
          filteredLogs.slice().reverse().map(log => (
            <div key={log.id} className={`log-entry ${getLogClass(log.action)}`}>
              <div className="flex flex-between align-start">
                <div>
                  <div style={{ fontWeight: 600 }}>{log.message}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    会话: <code>{log.session_id}</code> | 
                    动作: <span style={{ fontFamily: 'monospace' }}>{log.action}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
              {Object.keys(log.metadata || {}).length > 0 && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#667eea' }}>
                    查看详情
                  </summary>
                  <pre style={{ 
                    fontSize: '0.8rem', 
                    marginTop: '0.5rem', 
                    background: '#f5f5f5', 
                    padding: '0.5rem', 
                    borderRadius: '4px',
                    margin: 0,
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}

        <div style={{ marginTop: '1rem', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
          共 {filteredLogs.length} 条日志
        </div>
      </div>
    </div>
  );
}

export default CollaborationLogs;
