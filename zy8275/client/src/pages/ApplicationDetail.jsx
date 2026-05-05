import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { getStatusBadgeClass, formatDate, getActionButtonClass } from '../utils';

function ActionModal({ action, application, currentUser, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(action, comment);
      onClose();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = (action) => {
    const titles = {
      'SUBMIT': '提交申请',
      'ENGINEERING_REVIEW_START': '开始工程审核',
      'ENGINEERING_APPROVE': '工程审核通过',
      'ENGINEERING_REJECT': '工程审核拒绝',
      'SECURITY_REVIEW_START': '开始安保审核',
      'SECURITY_APPROVE': '安保放行',
      'SECURITY_REJECT': '安保拒绝',
      'CHECK_IN': '登记进场',
      'PAUSE': '暂停整改',
      'RESUME': '复工',
      'COMPLETE': '完成施工',
      'ARCHIVE': '归档',
      'CANCEL': '取消申请',
    };
    return titles[action] || '确认操作';
  };

  const requiresComment = ['ENGINEERING_REJECT', 'SECURITY_REJECT', 'PAUSE', 'RESUME'].includes(action);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{getModalTitle(action)}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">申请标题</label>
            <p style={{ color: '#333' }}>{application.title}</p>
          </div>
          <div className="form-group">
            <label className="form-label">当前状态</label>
            <p>
              <span className={`status-badge ${getStatusBadgeClass(application.status)}`}>
                {application.status_display}
              </span>
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">操作人</label>
            <p style={{ color: '#333' }}>{currentUser.name} ({currentUser.role_name})</p>
          </div>
          <div className="form-group">
            <label className="form-label">
              备注 {requiresComment && <span style={{ color: 'red' }}>*</span>}
            </label>
            <textarea
              className="form-control"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入备注信息..."
              required={requiresComment}
            />
          </div>
          <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button 
              type="submit" 
              className={`btn ${getActionButtonClass(action)}`}
              disabled={loading}
            >
              {loading ? '处理中...' : '确认'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApplicationDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [availableActions, setAvailableActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appResponse, actionsResponse] = await Promise.all([
        axios.get(`/api/applications/${id}`),
        currentUser ? axios.get(`/api/applications/${id}/available-actions?user_role=${currentUser.role_id}`) : null
      ]);
      setApplication(appResponse.data);
      if (actionsResponse) {
        setAvailableActions(actionsResponse.data.available_actions);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || '加载数据失败');
      console.error('Failed to fetch application:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, currentUser]);

  const handleAction = async (action, comment) => {
    try {
      const response = await axios.post(`/api/applications/${id}/actions`, {
        action_type: action,
        actor_id: currentUser.id,
        actor_role: currentUser.role_id,
        comment: comment || null
      });

      setSuccess(`操作成功！新状态: ${response.data.new_status_display}`);
      setTimeout(() => setSuccess(null), 3000);
      
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || '操作失败');
      throw err;
    }
  };

  if (loading) {
    return <div className="loading"><p>加载中...</p></div>;
  }

  if (error && !application) {
    return (
      <div>
        <div className="error">{error}</div>
        <Link to="/" className="btn btn-primary">返回看板</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" className="btn btn-secondary btn-sm">← 返回看板</Link>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{application.title}</h2>
          <span className={`status-badge ${getStatusBadgeClass(application.status)}`}>
            {application.status_display}
          </span>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-item">
              <div className="detail-label">店铺</div>
              <div className="detail-value">
                {application.shop_name} ({application.floor} {application.shop_number})
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">施工类型</div>
              <div className="detail-value">{application.construction_type}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">申请人</div>
              <div className="detail-value">{application.creator_name}</div>
            </div>
          </div>
          <div>
            <div className="detail-item">
              <div className="detail-label">计划开始时间</div>
              <div className="detail-value">{formatDate(application.start_time)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">计划结束时间</div>
              <div className="detail-value">{formatDate(application.end_time)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">创建时间</div>
              <div className="detail-value">{formatDate(application.created_at)}</div>
            </div>
          </div>
        </div>

        {application.description && (
          <div className="detail-item" style={{ marginTop: '15px' }}>
            <div className="detail-label">申请描述</div>
            <div className="detail-value">{application.description}</div>
          </div>
        )}

        {application.blueprint_url && (
          <div className="detail-item" style={{ marginTop: '15px' }}>
            <div className="detail-label">施工图纸</div>
            <div className="detail-value">
              <a href={application.blueprint_url} target="_blank" rel="noopener noreferrer">
                查看图纸
              </a>
            </div>
          </div>
        )}
      </div>

      {availableActions.length > 0 && (
        <div className="card action-panel">
          <h4>可执行操作</h4>
          <div className="btn-group">
            {availableActions.map((item) => (
              <button
                key={item.action}
                className={`btn ${getActionButtonClass(item.action)}`}
                onClick={() => setShowModal(item.action)}
              >
                {item.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">审批流程历史</h3>
        </div>
        
        {application.history && application.history.length > 0 ? (
          <div className="timeline">
            {application.history.map((action, index) => (
              <div key={action.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-action">{action.action_type_display}</span>
                    <span className="timeline-time">{formatDate(action.created_at)}</span>
                  </div>
                  <div className="timeline-actor">
                    <strong>{action.actor_name}</strong> ({action.actor_role_display})
                  </div>
                  {(action.from_status || action.to_status) && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
                      状态变更: 
                      {action.from_status && (
                        <span style={{ margin: '0 5px' }}>
                          <span className={`status-badge ${getStatusBadgeClass(action.from_status)}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                            {action.from_status}
                          </span>
                        </span>
                      )}
                      {action.from_status && <span>→</span>}
                      <span style={{ margin: '0 5px' }}>
                        <span className={`status-badge ${getStatusBadgeClass(action.to_status)}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                          {action.to_status}
                        </span>
                      </span>
                    </div>
                  )}
                  {action.comment && (
                    <div className="timeline-comment" style={{ marginTop: '8px' }}>
                      备注: {action.comment}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>暂无审批记录</p>
          </div>
        )}
      </div>

      {showModal && (
        <ActionModal
          action={showModal}
          application={application}
          currentUser={currentUser}
          onClose={() => setShowModal(null)}
          onSubmit={handleAction}
        />
      )}
    </div>
  );
}

export default ApplicationDetail;
