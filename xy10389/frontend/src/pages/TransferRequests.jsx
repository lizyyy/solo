import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { transferRequestsAPI, hospitalizationsAPI } from '../services/api';
import HospitalizationDetail from '../components/HospitalizationDetail';

function TransferRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    status: ''
  });

  const [selectedHosp, setSelectedHosp] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await transferRequestsAPI.getAll();
      setRequests(response.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filters.status && r.status !== filters.status) return false;
    return true;
  });

  const getStatusLabel = (status) => {
    const labels = {
      pending: '待处理',
      approved: '已确认',
      rejected: '已驳回',
      closed: '已关闭'
    };
    return labels[status] || status;
  };

  const handleApprove = async (requestId) => {
    if (!window.confirm('确认批准该转笼申请吗？')) return;

    setProcessing(requestId);
    try {
      await transferRequestsAPI.approve(requestId, {
        reviewed_by: '当前用户'
      });
      alert('转笼申请已批准！');
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId) => {
    const reason = window.prompt('请输入驳回原因:');
    if (reason === null) return;

    setProcessing(requestId);
    try {
      await transferRequestsAPI.reject(requestId, {
        reviewed_by: '当前用户',
        rejection_reason: reason
      });
      alert('转笼申请已驳回！');
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleClose = async (requestId) => {
    if (!window.confirm('确认关闭该转笼申请吗？')) return;

    setProcessing(requestId);
    try {
      await transferRequestsAPI.close(requestId, {
        reviewed_by: '当前用户'
      });
      alert('转笼申请已关闭！');
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessing(null);
    }
  };

  const statusCounts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    closed: requests.filter(r => r.status === 'closed').length
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
        <div className="stat-card warning">
          <div className="label">待处理</div>
          <div className="value">{statusCounts.pending}</div>
        </div>
        <div className="stat-card">
          <div className="label">已确认</div>
          <div className="value">{statusCounts.approved}</div>
        </div>
        <div className="stat-card">
          <div className="label">已驳回</div>
          <div className="value">{statusCounts.rejected}</div>
        </div>
        <div className="stat-card">
          <div className="label">已关闭</div>
          <div className="value">{statusCounts.closed}</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label>状态</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="approved">已确认</option>
            <option value="rejected">已驳回</option>
            <option value="closed">已关闭</option>
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>转笼申请列表</h3>
        </div>

        {filteredRequests.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>住院号</th>
                <th>宠物</th>
                <th>原笼位</th>
                <th>目标笼位</th>
                <th>转笼原因</th>
                <th>申请人</th>
                <th>申请时间</th>
                <th>状态</th>
                <th>驳回原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => (
                <tr key={request.id}>
                  <td
                    style={{ cursor: 'pointer', color: '#667eea', fontWeight: '600' }}
                    onClick={() => setSelectedHosp(request.hospitalization_id)}
                  >
                    {request.admission_number}
                  </td>
                  <td>{request.pet_name}</td>
                  <td>{request.from_cage_number}</td>
                  <td>{request.to_cage_number}</td>
                  <td>{request.request_reason || '-'}</td>
                  <td>{request.requested_by || '-'}</td>
                  <td>{dayjs(request.requested_at).format('MM-DD HH:mm')}</td>
                  <td>
                    <span className={`status-badge status-${request.status}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </td>
                  <td>{request.rejection_reason || '-'}</td>
                  <td>
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-success"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => handleApprove(request.id)}
                          disabled={processing === request.id}
                        >
                          批准
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => handleReject(request.id)}
                          disabled={processing === request.id}
                        >
                          驳回
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => handleClose(request.id)}
                          disabled={processing === request.id}
                        >
                          关闭
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="icon">🔄</div>
            <p>暂无转笼申请</p>
          </div>
        )}
      </div>

      {selectedHosp && (
        <HospitalizationDetail
          hospId={selectedHosp}
          onClose={() => setSelectedHosp(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

export default TransferRequests;
