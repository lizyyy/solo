import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function RequestList() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      let url = '/api/requests';
      if (statusFilter) {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    const map = {
      'DRAFT': 'status-draft',
      'PENDING_APPROVAL': 'status-pending',
      'APPROVED': 'status-approved',
      'EXECUTING': 'status-executing',
      'COMPLETED': 'status-completed',
      'PARTIAL_COMPLETED': 'status-partial',
      'FAILED': 'status-failed'
    };
    return map[status] || 'status-draft';
  };

  const getStatusText = (status) => {
    const map = {
      'DRAFT': '草稿',
      'PENDING_APPROVAL': '待审批',
      'APPROVED': '已批准',
      'EXECUTING': '执行中',
      'COMPLETED': '已完成',
      'PARTIAL_COMPLETED': '部分完成',
      'FAILED': '失败'
    };
    return map[status] || status;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="flex flex-between">
          <h2>删除申请列表</h2>
          <div className="flex">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="PENDING_APPROVAL">待审批</option>
              <option value="APPROVED">已批准</option>
              <option value="EXECUTING">执行中</option>
              <option value="COMPLETED">已完成</option>
              <option value="PARTIAL_COMPLETED">部分完成</option>
              <option value="FAILED">失败</option>
            </select>
            <Link to="/create">
              <button className="btn btn-primary">新建申请</button>
            </Link>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>申请编号</th>
              <th>客户ID</th>
              <th>客户名称</th>
              <th>删除原因</th>
              <th>申请人</th>
              <th>状态</th>
              <th>任务进度</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(request => (
              <tr key={request.id}>
                <td>{request.request_no}</td>
                <td>{request.customer_id}</td>
                <td>{request.customer_name}</td>
                <td>{request.reason}</td>
                <td>{request.requested_by}</td>
                <td><span className={`status-badge ${getStatusClass(request.status)}`}>{getStatusText(request.status)}</span></td>
                <td>
                  {request.task_count > 0 
                    ? `${request.completed_tasks || 0}/${request.task_count}` 
                    : '-'}
                </td>
                <td>{new Date(request.created_at).toLocaleString()}</td>
                <td>
                  <Link to={`/requests/${request.id}`}>
                    <button className="btn btn-link btn-sm">查看</button>
                  </Link>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RequestList;
