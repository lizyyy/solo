import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function SessionDetail({ api, currentUser }) {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [lockStatus, setLockStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [offlineContent, setOfflineContent] = useState('');
  const [offlineDuration, setOfflineDuration] = useState(0);
  const [isDirtyData, setIsDirtyData] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [resolvedContent, setResolvedContent] = useState('');
  const [logs, setLogs] = useState([]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const [sessionRes, lockRes, logsRes] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get(`/sessions/${id}/lock-status`),
        api.get(`/collaboration-logs?session_id=${id}`)
      ]);
      setSession(sessionRes.data);
      setLockStatus(lockRes.data);
      setEditContent(sessionRes.data.content);
      setLogs(logsRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  const acquireLock = async () => {
    try {
      const response = await api.post(`/sessions/${id}/lock`, { user_id: currentUser });
      if (response.data.acquired) {
        setLockStatus(response.data.lock);
      }
      fetchSession();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(`锁被其他用户持有: ${err.response.data.lock_holder}`);
      }
    }
  };

  const releaseLock = async () => {
    try {
      await api.delete(`/sessions/${id}/lock`, { data: { user_id: currentUser } });
      fetchSession();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateContent = async () => {
    try {
      await api.post(`/sessions/${id}/update`, {
        user_id: currentUser,
        content: editContent,
        version: session.version
      });
      fetchSession();
    } catch (err) {
      if (err.response?.status === 409) {
        setError('版本冲突: ' + JSON.stringify(err.response.data.conflict, null, 2));
      } else {
        setError(err.message);
      }
    }
  };

  const handleOfflineMerge = async () => {
    try {
      const response = await api.post(`/sessions/${id}/offline-merge`, {
        user_id: currentUser,
        offline_content: offlineContent,
        offline_duration: offlineDuration,
        is_dirty: isDirtyData
      });
      fetchSession();
    } catch (err) {
      setError('离线合并失败: ' + JSON.stringify(err.response?.data || {}, null, 2));
    }
  };

  const resolveConflict = async (resolution) => {
    if (!selectedConflict) return;
    try {
      await api.post(`/sessions/${id}/resolve-conflict`, {
        conflict_id: selectedConflict.id,
        resolution: resolution,
        resolved_content: resolvedContent
      });
      setSelectedConflict(null);
      fetchSession();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVersionReplay = async () => {
    try {
      await api.post(`/sessions/${id}/version-replay`, {
        target_version: session.version - 1,
        replay_content: session.original_content
      });
      fetchSession();
    } catch (err) {
      setError(err.message);
    }
  };

  const isLockHolder = lockStatus?.user_id === currentUser;
  const isLocked = lockStatus && lockStatus.user_id;

  if (loading) return <div className="card"><span className="spinner"></span> 加载中...</div>;
  if (!session) return <div className="card">会话不存在</div>;

  return (
    <div>
      <div className="flex flex-between align-center" style={{ marginBottom: '1rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#667eea' }}>← 返回列表</Link>
        <button 
          className="btn retry-btn" 
          onClick={fetchSession}
        >
          🔄 刷新
        </button>
      </div>

      {error && (
        <div className="error-box">
          <div className="flex flex-between align-center">
            <div>
              <div className="error-title">操作错误</div>
              <div className="error-detail">{error}</div>
            </div>
            <button 
              className="btn" 
              onClick={() => setError(null)}
            >
              ✕ 关闭
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>{session.title}</h2>
        <div className="flex flex-between align-center" style={{ marginBottom: '1rem' }}>
          <div>
            <span style={{ marginRight: '1rem' }}>版本: <strong>v{session.version}</strong></span>
            <span style={{ marginRight: '1rem' }}>
              锁状态: 
              {isLocked ? (
                <span className="status-badge status-locked" style={{ marginLeft: '0.5rem' }}>
                  🔒 被 {lockStatus.user_id} 持有
                </span>
              ) : (
                <span className="status-badge status-unlocked" style={{ marginLeft: '0.5rem' }}>
                  🔓 未锁定
                </span>
              )}
            </span>
          </div>
          <div className="flex">
            {!isLocked ? (
              <button className="btn btn-primary" onClick={acquireLock}>
                🔒 获取编辑锁
              </button>
            ) : isLockHolder ? (
              <>
                <button className="btn btn-success" onClick={updateContent}>
                  💾 保存更改
                </button>
                <button className="btn btn-danger" onClick={releaseLock}>
                  🔓 释放锁
                </button>
              </>
            ) : (
              <button className="btn" disabled>
                ⏳ 等待锁释放
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <h3 className="section-title">编辑内容</h3>
            <textarea 
              className="input textarea"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              disabled={!isLockHolder}
              style={{ background: isLockHolder ? 'white' : '#f5f5f5' }}
            />
          </div>
          <div>
            <h3 className="section-title">原始输入 (对比)</h3>
            <div className="diff-view" style={{ minHeight: '150px' }}>
              {session.original_content || '(无)'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">📡 离线合并测试</h3>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">离线编辑内容</label>
            <textarea 
              className="input textarea"
              value={offlineContent}
              onChange={e => setOfflineContent(e.target.value)}
              placeholder="输入离线编辑的内容..."
            />
          </div>
          <div>
            <div className="form-group">
              <label className="form-label">离线时长（秒）</label>
              <input 
                type="number" 
                className="input"
                value={offlineDuration}
                onChange={e => setOfflineDuration(parseInt(e.target.value) || 0)}
              />
              <small style={{ color: '#666' }}>超过 3600 秒会触发长时间离线冲突规则</small>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox"
                  checked={isDirtyData}
                  onChange={e => setIsDirtyData(e.target.checked)}
                />
                标记为脏数据（会被规则拦截）
              </label>
            </div>
          </div>
        </div>
        <button className="btn btn-warning" onClick={handleOfflineMerge}>
          提交离线合并
        </button>
      </div>

      {session.conflicts.length > 0 && (
        <div className="card">
          <h3 className="section-title">⚠️ 待解决冲突 ({session.conflicts.length})</h3>
          {session.conflicts.map((conflict, idx) => (
            <div 
              key={conflict.id}
              style={{ 
                padding: '1rem', 
                background: conflict.resolved ? '#efe' : '#fff5f5', 
                borderRadius: '4px',
                marginBottom: '0.5rem',
                border: conflict.resolved ? '1px solid #cfc' : '1px solid #fcc'
              }}
            >
              <div className="flex flex-between align-center">
                <div>
                  <strong>冲突类型:</strong> {conflict.type}
                  {conflict.resolved && <span style={{ color: '#27ae60', marginLeft: '0.5rem' }}>✓ 已解决</span>}
                </div>
                {!conflict.resolved && (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedConflict(conflict);
                      setResolvedContent(conflict.server_content);
                    }}
                  >
                    处理
                  </button>
                )}
              </div>
              {conflict.description && <p>{conflict.description}</p>}
              {conflict.original_dirty_input && (
                <div>
                  <strong>脏数据原始输入:</strong>
                  <div className="diff-view diff-old">{conflict.original_dirty_input}</div>
                  <strong>服务器内容:</strong>
                  <div className="diff-view diff-new">{conflict.server_content_at_time}</div>
                </div>
              )}
              {selectedConflict?.id === conflict.id && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                  <h4>解决冲突</h4>
                  <div className="form-group">
                    <label className="form-label">合并后内容</label>
                    <textarea 
                      className="input textarea"
                      value={resolvedContent}
                      onChange={e => setResolvedContent(e.target.value)}
                    />
                  </div>
                  <div className="flex" style={{ gap: '0.5rem' }}>
                    <button className="btn btn-success" onClick={() => resolveConflict('use_server')}>
                      使用服务器版本
                    </button>
                    <button className="btn btn-warning" onClick={() => resolveConflict('use_client')}>
                      使用客户端版本
                    </button>
                    <button className="btn btn-primary" onClick={() => resolveConflict('manual')}>
                      使用手动合并版本
                    </button>
                    <button className="btn" onClick={() => setSelectedConflict(null)}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button className="btn" onClick={handleVersionReplay} style={{ marginTop: '0.5rem' }}>
            🎬 版本回放到上一版
          </button>
        </div>
      )}

      <div className="card">
        <h3 className="section-title">📋 协作日志</h3>
        {logs.length === 0 ? (
          <p style={{ color: '#888' }}>暂无日志</p>
        ) : (
          logs.slice().reverse().map(log => (
            <div 
              key={log.id} 
              className={`log-entry ${
                log.action.includes('error') || log.action.includes('blocked') || log.action.includes('conflict')
                  ? 'log-entry-error'
                  : log.action.includes('success') || log.action.includes('resolved')
                  ? 'log-entry-success'
                  : log.action.includes('warning')
                  ? 'log-entry-warning'
                  : 'log-entry-info'
              }`}
            >
              <div style={{ fontWeight: 600 }}>{log.message}</div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                {new Date(log.timestamp).toLocaleString()} | 动作: {log.action}
              </div>
              {Object.keys(log.metadata || {}).length > 0 && (
                <pre style={{ fontSize: '0.8rem', marginTop: '0.5rem', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', margin: 0 }}>
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SessionDetail;
