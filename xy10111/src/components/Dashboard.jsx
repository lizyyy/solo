import React from 'react';
import { DISPATCH_STATUS, DISPATCH_STATUS_LABELS, formatDateTime } from '../utils/helpers';

function Dashboard({ data, onNavigate }) {
  const { meetings, dispatches } = data;

  const totalMeetings = meetings.length;
  const totalAttachments = meetings.reduce((sum, m) => sum + (m.attachments?.length || 0), 0);
  const totalDispatches = dispatches.length;
  const pendingDispatches = dispatches.filter(
    d => d.status === DISPATCH_STATUS.PENDING || d.status === DISPATCH_STATUS.REVIEWING
  ).length;

  const recentDispatches = [...dispatches]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const recentMeetings = [...meetings]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const getMeetingInfo = (meetingId) => {
    return meetings.find(m => m.id === meetingId);
  };

  const getGroupNames = (meeting, groupIds) => {
    if (!meeting || !meeting.groups) return '';
    return meeting.groups
      .filter(g => groupIds.includes(g.id))
      .map(g => g.name)
      .join('、');
  };

  return (
    <div>
      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-value">{totalMeetings}</div>
          <div className="stat-label">会议总数</div>
          <div className="stat-icon">📋</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalAttachments}</div>
          <div className="stat-label">附件总数</div>
          <div className="stat-icon">📎</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalDispatches}</div>
          <div className="stat-label">分发记录</div>
          <div className="stat-icon">📤</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pendingDispatches}</div>
          <div className="stat-label">待处理分发</div>
          <div className="stat-icon">⏳</div>
        </div>
      </div>

      <div className="row">
        <div className="col-6">
          <div className="card">
            <div className="card-header">
              <h3>最近分发记录</h3>
              <button 
                className="btn btn-sm btn-default"
                onClick={() => onNavigate('history')}
              >
                查看全部
              </button>
            </div>
            <div className="card-body">
              {recentDispatches.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📤</div>
                  <div className="empty-state-title">暂无分发记录</div>
                  <div className="empty-state-message">开始创建您的第一条分发记录吧</div>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>会议</th>
                      <th>接收小组</th>
                      <th>时间</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDispatches.map(dispatch => {
                      const meeting = getMeetingInfo(dispatch.meetingId);
                      return (
                        <tr key={dispatch.id}>
                          <td className="font-bold">{meeting?.title || '未知会议'}</td>
                          <td className="text-muted">
                            {getGroupNames(meeting, dispatch.groupIds) || '未分配小组'}
                          </td>
                          <td className="text-muted">
                            {formatDateTime(dispatch.createdAt)}
                          </td>
                          <td>
                            <span className={`badge ${dispatch.status === 'sent' ? 'badge-success' : dispatch.status === 'confirmed' ? 'badge-primary' : dispatch.status === 'reviewing' ? 'badge-warning' : dispatch.status === 'cancelled' ? 'badge-danger' : 'badge-default'}`}>
                              {DISPATCH_STATUS_LABELS[dispatch.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="col-6">
          <div className="card">
            <div className="card-header">
              <h3>最近会议</h3>
              <button 
                className="btn btn-sm btn-default"
                onClick={() => onNavigate('meetings')}
              >
                管理会议
              </button>
            </div>
            <div className="card-body">
              {recentMeetings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">暂无会议</div>
                  <div className="empty-state-message">点击「会议管理」创建新会议</div>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>会议标题</th>
                      <th>日期</th>
                      <th>附件数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMeetings.map(meeting => (
                      <tr key={meeting.id}>
                        <td className="font-bold">{meeting.title}</td>
                        <td className="text-muted">{meeting.date}</td>
                        <td>
                          <span className="badge badge-primary">
                            {meeting.attachments?.length || 0} 个
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>快速操作</h3>
        </div>
        <div className="card-body">
          <div className="row" style={{ gap: '16px' }}>
            <button 
              className="btn btn-primary"
              onClick={() => onNavigate('meetings')}
              style={{ padding: '12px 24px' }}
            >
              📋 新建会议
            </button>
            <button 
              className="btn btn-success"
              onClick={() => onNavigate('dispatch')}
              style={{ padding: '12px 24px' }}
            >
              📤 开始分发
            </button>
            <button 
              className="btn btn-warning"
              onClick={() => onNavigate('groups')}
              style={{ padding: '12px 24px' }}
            >
              👥 管理小组
            </button>
            <button 
              className="btn btn-default"
              onClick={() => onNavigate('history')}
              style={{ padding: '12px 24px' }}
            >
              📜 查看历史
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
