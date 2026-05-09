import React, { useState } from 'react';
import { dataStore } from '../utils/dataStore';
import {
  DISPATCH_STATUS,
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_COLORS,
  formatDateTime,
  formatFileSize,
  getFileIcon,
  confirmAction,
  toast,
  exportToExcel,
  exportToCSV,
  openFileInFolder,
} from '../utils/helpers';

function HistoryPage({ data, refreshData }) {
  const { dispatches, meetings } = data;
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMeeting, setFilterMeeting] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const sortedDispatches = [...dispatches].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const filteredDispatches = sortedDispatches.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterMeeting !== 'all' && d.meetingId !== filterMeeting) return false;
    if (searchText) {
      const text = searchText.toLowerCase();
      return (
        d.meetingTitle?.toLowerCase().includes(text) ||
        d.groups?.some(g => g.name?.toLowerCase().includes(text)) ||
        d.attachments?.some(a => a.name?.toLowerCase().includes(text))
      );
    }
    return true;
  });

  const meetingOptions = [...new Set(dispatches.map(d => d.meetingId))]
    .map(id => {
      const meeting = meetings.find(m => m.id === id);
      return { id, title: meeting?.title || d?.meetingTitle || '未知会议' };
    });

  const handleUpdateStatus = async (dispatch, newStatus) => {
    const updatedDispatches = dispatches.map(d => {
      if (d.id === dispatch.id) {
        return {
          ...d,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(newStatus === DISPATCH_STATUS.SENT && { sentAt: new Date().toISOString() }),
          ...(newStatus === DISPATCH_STATUS.CONFIRMED && { confirmedAt: new Date().toISOString() }),
          ...(newStatus === DISPATCH_STATUS.CANCELLED && { cancelledAt: new Date().toISOString() }),
        };
      }
      return d;
    });

    const saved = await dataStore.saveDispatches(updatedDispatches);
    if (saved) {
      toast.success(`状态已更新为：${DISPATCH_STATUS_LABELS[newStatus]}`);
      await refreshData();
    } else {
      toast.error('更新失败，请重试');
    }
  };

  const handleCancel = async (dispatch) => {
    const confirmed = await confirmAction(
      `确定要取消这条分发记录吗？\n\n会议：${dispatch.meetingTitle}`,
      '确认取消'
    );
    if (confirmed) {
      await handleUpdateStatus(dispatch, DISPATCH_STATUS.CANCELLED);
    }
  };

  const handleMarkSent = async (dispatch) => {
    const confirmed = await confirmAction(
      `确认已将附件发送给所有指定小组？\n\n会议：${dispatch.meetingTitle}\n小组：${dispatch.groups?.map(g => g.name).join('、')}`,
      '确认发送'
    );
    if (confirmed) {
      await handleUpdateStatus(dispatch, DISPATCH_STATUS.SENT);
    }
  };

  const handleViewDetail = (dispatch) => {
    setSelectedDispatch(dispatch);
    setShowDetailModal(true);
  };

  const handleExportExcel = async () => {
    if (filteredDispatches.length === 0) {
      toast.warning('没有可导出的数据');
      return;
    }

    const exportData = filteredDispatches.map(d => ({
      '会议标题': d.meetingTitle || '',
      '会议日期': d.meetingDate || '',
      '接收小组': d.groups?.map(g => g.name).join('；') || '',
      '附件列表': d.attachments?.map(a => a.name).join('；') || '',
      '附件数量': d.attachments?.length || 0,
      '小组成员': d.groups?.map(g => `${g.name}(${g.members?.join('、') || ''})`).join('；') || '',
      '状态': DISPATCH_STATUS_LABELS[d.status] || '',
      '备注': d.notes || '',
      '创建时间': formatDateTime(d.createdAt),
      '发送时间': d.sentAt ? formatDateTime(d.sentAt) : '',
    }));

    const filePath = await exportToExcel(
      exportData,
      `分发记录_${new Date().toISOString().split('T')[0]}`
    );

    if (filePath) {
      toast.success('导出成功！');
    }
  };

  const handleExportCSV = async () => {
    if (filteredDispatches.length === 0) {
      toast.warning('没有可导出的数据');
      return;
    }

    const exportData = filteredDispatches.map(d => ({
      '会议标题': d.meetingTitle || '',
      '会议日期': d.meetingDate || '',
      '接收小组': d.groups?.map(g => g.name).join('；') || '',
      '附件列表': d.attachments?.map(a => a.name).join('；') || '',
      '状态': DISPATCH_STATUS_LABELS[d.status] || '',
      '创建时间': formatDateTime(d.createdAt),
    }));

    const filePath = await exportToCSV(
      exportData,
      `分发记录_${new Date().toISOString().split('T')[0]}`
    );

    if (filePath) {
      toast.success('导出成功！');
    }
  };

  const handleExportDispatchDetail = async (dispatch) => {
    const exportData = [];

    exportData.push({ '分发信息': '' });
    exportData.push({ '会议标题': dispatch.meetingTitle });
    exportData.push({ '会议日期': dispatch.meetingDate });
    exportData.push({ '状态': DISPATCH_STATUS_LABELS[dispatch.status] });
    exportData.push({ '创建时间': formatDateTime(dispatch.createdAt) });
    if (dispatch.sentAt) {
      exportData.push({ '发送时间': formatDateTime(dispatch.sentAt) });
    }
    if (dispatch.notes) {
      exportData.push({ '备注': dispatch.notes });
    }
    exportData.push({ '': '' });

    exportData.push({ '附件清单': '' });
    (dispatch.attachments || []).forEach((att, idx) => {
      exportData.push({
        '序号': idx + 1,
        '附件名称': att.name,
        '文件路径': att.filePath,
        '大小': formatFileSize(att.size),
      });
    });
    exportData.push({ '': '' });

    exportData.push({ '接收清单': '' });
    (dispatch.groups || []).forEach((group, idx) => {
      exportData.push({
        '序号': idx + 1,
        '小组名称': group.name,
        '成员': group.members?.join('、') || '',
      });
    });

    const filePath = await exportToExcel(
      exportData,
      `分发清单_${dispatch.meetingTitle}_${new Date().toISOString().split('T')[0]}`
    );

    if (filePath) {
      toast.success('分发清单导出成功！');
    }
  };

  const getNextStatusOptions = (currentStatus) => {
    const transitions = {
      [DISPATCH_STATUS.PENDING]: [
        { status: DISPATCH_STATUS.CONFIRMED, label: '确认分发', btnClass: 'btn-primary' },
        { status: DISPATCH_STATUS.SENT, label: '标记已发送', btnClass: 'btn-success' },
      ],
      [DISPATCH_STATUS.REVIEWING]: [
        { status: DISPATCH_STATUS.CONFIRMED, label: '确认分发', btnClass: 'btn-primary' },
        { status: DISPATCH_STATUS.SENT, label: '标记已发送', btnClass: 'btn-success' },
      ],
      [DISPATCH_STATUS.CONFIRMED]: [
        { status: DISPATCH_STATUS.SENT, label: '标记已发送', btnClass: 'btn-success' },
      ],
      [DISPATCH_STATUS.SENT]: [],
      [DISPATCH_STATUS.CANCELLED]: [],
    };
    return transitions[currentStatus] || [];
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>分发历史记录</h3>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-default" onClick={handleExportCSV}>
              📄 导出 CSV
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleExportExcel}>
              📊 导出 Excel
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="row mb-4" style={{ gap: '16px' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <label>搜索</label>
              <input
                type="text"
                className="form-control"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索会议、小组、附件..."
              />
            </div>
            <div className="form-group" style={{ width: '200px', marginBottom: 0 }}>
              <label>状态筛选</label>
              <div className="select-wrapper">
                <select
                  className="form-control"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">全部状态</option>
                  {Object.entries(DISPATCH_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ width: '250px', marginBottom: 0 }}>
              <label>会议筛选</label>
              <div className="select-wrapper">
                <select
                  className="form-control"
                  value={filterMeeting}
                  onChange={(e) => setFilterMeeting(e.target.value)}
                >
                  <option value="all">全部会议</option>
                  {meetingOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredDispatches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📜</div>
              <div className="empty-state-title">暂无分发记录</div>
              <div className="empty-state-message">
                去「附件分发」页面创建您的第一条分发记录吧
              </div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>会议</th>
                  <th>接收小组</th>
                  <th>附件</th>
                  <th>创建时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.map(dispatch => (
                  <tr key={dispatch.id}>
                    <td>
                      <div className="font-bold">{dispatch.meetingTitle}</div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        {dispatch.meetingDate}
                      </div>
                    </td>
                    <td>
                      {dispatch.groups?.length > 0 ? (
                        <div>
                          {dispatch.groups.slice(0, 2).map((g, i) => (
                            <span key={i} className="badge badge-success" style={{ marginRight: '4px' }}>
                              {g.name}
                            </span>
                          ))}
                          {dispatch.groups.length > 2 && (
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                              +{dispatch.groups.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-primary">
                        {dispatch.attachments?.length || 0} 个
                      </span>
                    </td>
                    <td className="text-muted">
                      {formatDateTime(dispatch.createdAt)}
                    </td>
                    <td>
                      <span className={`badge ${DISPATCH_STATUS_COLORS[dispatch.status]}`}>
                        {DISPATCH_STATUS_LABELS[dispatch.status]}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm btn-default"
                          onClick={() => handleViewDetail(dispatch)}
                        >
                          详情
                        </button>
                        <button
                          className="btn btn-sm btn-default"
                          onClick={() => handleExportDispatchDetail(dispatch)}
                        >
                          导出清单
                        </button>
                        {getNextStatusOptions(dispatch.status).map(option => (
                          <button
                            key={option.status}
                            className={`btn btn-sm ${option.btnClass}`}
                            onClick={() => {
                              if (option.status === DISPATCH_STATUS.SENT) {
                                handleMarkSent(dispatch);
                              } else {
                                handleUpdateStatus(dispatch, option.status);
                              }
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                        {dispatch.status !== DISPATCH_STATUS.CANCELLED &&
                         dispatch.status !== DISPATCH_STATUS.SENT && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleCancel(dispatch)}
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetailModal && selectedDispatch && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowDetailModal(false);
        }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>分发详情</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0 }}>基本信息</h4>
                </div>
                <div className="card-body" style={{ padding: '16px' }}>
                  <div className="row">
                    <div className="col-6">
                      <p><span className="text-muted">会议标题：</span>{selectedDispatch.meetingTitle}</p>
                      <p><span className="text-muted">会议日期：</span>{selectedDispatch.meetingDate}</p>
                    </div>
                    <div className="col-6">
                      <p>
                        <span className="text-muted">状态：</span>
                        <span className={`badge ${DISPATCH_STATUS_COLORS[selectedDispatch.status]}`}>
                          {DISPATCH_STATUS_LABELS[selectedDispatch.status]}
                        </span>
                      </p>
                      <p><span className="text-muted">创建时间：</span>{formatDateTime(selectedDispatch.createdAt)}</p>
                      {selectedDispatch.sentAt && (
                        <p><span className="text-muted">发送时间：</span>{formatDateTime(selectedDispatch.sentAt)}</p>
                      )}
                    </div>
                  </div>
                  {selectedDispatch.notes && (
                    <div className="mt-4">
                      <p className="text-muted mb-2">备注：</p>
                      <p style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                        {selectedDispatch.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0 }}>
                    附件清单 ({selectedDispatch.attachments?.length || 0} 个)
                  </h4>
                </div>
                <div className="card-body" style={{ padding: '0' }}>
                  {(selectedDispatch.attachments || []).length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c' }}>
                      暂无附件
                    </div>
                  ) : (
                    selectedDispatch.attachments.map(att => (
                      <div
                        key={att.id}
                        className="file-item"
                        style={{ margin: '0', borderRadius: '0', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <div className="file-item-icon">
                          {getFileIcon(att.name)}
                        </div>
                        <div className="file-item-info">
                          <div className="file-item-name">{att.name}</div>
                          <div className="file-item-meta">
                            {formatFileSize(att.size)} · {att.filePath}
                          </div>
                        </div>
                        <div className="file-item-actions">
                          <button
                            className="btn btn-sm btn-default"
                            onClick={() => openFileInFolder(att.filePath)}
                          >
                            打开位置
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0 }}>
                    接收清单 ({selectedDispatch.groups?.length || 0} 个小组)
                  </h4>
                </div>
                <div className="card-body" style={{ padding: '0' }}>
                  {(selectedDispatch.groups || []).length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c' }}>
                      暂无接收小组
                    </div>
                  ) : (
                    selectedDispatch.groups.map(group => (
                      <div
                        key={group.id}
                        style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <div className="d-flex justify-between align-center">
                          <div>
                            <span className="font-bold">{group.name}</span>
                            <span className="text-muted" style={{ marginLeft: '8px' }}>
                              ({group.members?.length || 0} 人)
                            </span>
                          </div>
                        </div>
                        {group.members?.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            {group.members.map((member, idx) => (
                              <span key={idx} className="member-tag">
                                {member}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-default"
                onClick={() => handleExportDispatchDetail(selectedDispatch)}
              >
                📊 导出清单
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
