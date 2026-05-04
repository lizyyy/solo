import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';

function Home() {
  const navigate = useNavigate();
  const { sessions, fetchSessions, deleteSession, currentSessionId } = useStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        await fetchSessions();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSessionClick = (session) => {
    navigate(`/session/${session.id}`);
  };

  const handleDeleteClick = (e, session) => {
    e.stopPropagation();
    setShowDeleteConfirm(session);
  };

  const handleConfirmDelete = async () => {
    if (showDeleteConfirm) {
      await deleteSession(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (isLoading) {
    return (
      <div className="home-page">
        <div className="loading-container" style={{ flex: 1 }}>
          <div className="loading-spinner"></div>
          <p>加载训练场次列表...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="page-header">
        <h2>📋 训练场次列表</h2>
        <button className="btn btn-primary" onClick={() => navigate('/import')}>
          <span>+</span> 新建训练
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="no-sessions">
          <div className="no-sessions-icon">🔥</div>
          <h3>暂无训练场次</h3>
          <p>点击上方按钮导入数据，创建您的第一个训练场次</p>
          <button className="btn btn-primary" onClick={() => navigate('/import')}>
            <span>📥</span> 开始导入
          </button>
        </div>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-card ${session.id === currentSessionId ? 'selected' : ''}`}
              onClick={() => handleSessionClick(session)}
            >
              <div className="session-card-header">
                <div>
                  <h3>{session.name}</h3>
                  {session.description && <p>{session.description}</p>}
                </div>
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => handleDeleteClick(e, session)}
                >
                  🗑️
                </button>
              </div>
              <div className="session-card-meta">
                <span>创建时间: {formatDate(session.created_at)}</span>
                <span>更新时间: {formatDate(session.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认删除</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="confirm-dialog">
                <p>
                  确定要删除训练场次 <strong>"{showDeleteConfirm.name}"</strong> 吗？
                  <br />
                  此操作不可撤销，所有关联数据将被永久删除。
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                取消
              </button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
