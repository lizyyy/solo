import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    failed: 0
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/requests');
      const requests = await res.json();
      
      setStats({
        total: requests.length,
        pending: requests.filter(r => ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING'].includes(r.status)).length,
        completed: requests.filter(r => r.status === 'COMPLETED').length,
        failed: requests.filter(r => ['FAILED', 'PARTIAL_COMPLETED'].includes(r.status)).length
      });
      
      setRecentRequests(requests.slice(0, 5));
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
      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{stats.total}</div>
          <div className="label">总申请数</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: '#1890ff' }}>{stats.pending}</div>
          <div className="label">待处理</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: '#52c41a' }}>{stats.completed}</div>
          <div className="label">已完成</div>
        </div>
        <div className="stat-card">
          <div className="value" style={{ color: '#f5222d' }}>{stats.failed}</div>
          <div className="label">异常</div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-between">
          <h2>最近申请</h2>
          <Link to="/create">
            <button className="btn btn-primary">新建申请</button>
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>申请编号</th>
              <th>客户名称</th>
              <th>删除原因</th>
              <th>申请人</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {recentRequests.map(request => (
              <tr key={request.id}>
                <td>{request.request_no}</td>
                <td>{request.customer_name}</td>
                <td>{request.reason}</td>
                <td>{request.requested_by}</td>
                <td><span className={`status-badge ${getStatusClass(request.status)}`}>{getStatusText(request.status)}</span></td>
                <td>{new Date(request.created_at).toLocaleString()}</td>
                <td>
                  <Link to={`/requests/${request.id}`}>
                    <button className="btn btn-link btn-sm">查看</button>
                  </Link>
                </td>
              </tr>
            ))}
            {recentRequests.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
