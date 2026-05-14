import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Home({ api, currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSession, setNewSession] = useState({ title: '', content: '' });

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/sessions');
      setSessions(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initSampleData = async () => {
    try {
      await api.post('/init-sample-data');
      fetchSessions();
    } catch (err) {
      setError('初始化示例数据失败: ' + err.message);
    }
  };

  const createSession = async () => {
    try {
      await api.post('/sessions', newSession);
      setNewSession({ title: '', content: '' });
      setShowCreateForm(false);
      fetchSessions();
    } catch (err) {
      setError('创建会话失败: ' + err.message);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [retryCount]);

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-between align-center" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">📄 文档会话列表</h2>
        <div className="flex">
          <button className="btn btn-warning" onClick={initSampleData}>
            📦 初始化示例数据
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            ➕ 新建文档
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <div className="flex flex-between align-center">
            <div>
              <div className="error-title">请求失败</div>
              <div className="error-detail">{error}</div>
            </div>
            <button 
              className="btn btn-primary retry-btn" 
              onClick={() => setRetryCount(c => c + 1)}
            >
              🔄 重试
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="card">
          <h3 className="section-title">创建新文档</h3>
          <div className="form-group">
            <label className="form-label">文档标题</label>
            <input 
              type="text" 
              className="input"
              value={newSession.title}
              onChange={e => setNewSession({...newSession, title: e.target.value})}
              placeholder="输入文档标题..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">初始内容</label>
            <textarea 
              className="input textarea"
              value={newSession.content}
              onChange={e => setNewSession({...newSession, content: e.target.value})}
              placeholder="输入初始内容..."
            />
          </div>
          <div className="flex">
            <button className="btn btn-success" onClick={createSession}>创建</button>
            <button className="btn" onClick={() => setShowCreateForm(false)}>取消</button>
          </div>
        </div>
      )}

      <div className="search-box">
        <input 
          type="text" 
          className="input"
          placeholder="🔍 搜索文档标题..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <span className="spinner"></span> 加载中...
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#666' }}>
          {searchTerm ? '没有找到匹配的文档' : '暂无文档，请点击上方按钮创建或初始化示例数据'}
        </div>
      ) : (
        <div className="grid grid-2">
          {filteredSessions.map(session => (
            <Link 
              to={`/session/${session.id}`} 
              key={session.id}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                   onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div className="flex flex-between align-center">
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>{session.title}</h3>
                  <span className="status-badge status-unlocked">v{session.version}</span>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                  ID: {session.id}
                </p>
                <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>
                  协作者: {session.collaborators.join(', ') || '无'}
                </p>
                {session.conflicts.length > 0 && (
                  <div style={{ marginTop: '0.5rem', color: '#f39c12', fontSize: '0.85rem' }}>
                    ⚠️ 存在 {session.conflicts.length} 个待解决冲突
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
