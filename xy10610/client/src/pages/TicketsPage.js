import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const TicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  useEffect(() => {
    fetchTickets();
  }, [pagination.page, filters]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = { ...filters, page: pagination.page, limit: pagination.limit };
      const res = await axios.get('/api/tickets', { params });
      setTickets(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (err) {
      console.error('获取工单列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await axios.put(`/api/tickets/${ticketId}/status`, {
        status: newStatus,
        operator: '当前用户'
      });
      fetchTickets();
    } catch (err) {
      console.error('更新工单状态失败:', err);
    }
  };

  const handleEscalate = async (ticketId) => {
    try {
      await axios.post(`/api/tickets/${ticketId}/escalate`, {
        operator: '当前用户',
        reason: '用户主动升级'
      });
      fetchTickets();
    } catch (err) {
      console.error('升级工单失败:', err);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">补资料工单</h1>
        <button className="btn btn-primary" onClick={() => {
          axios.get('/api/export/tickets', { responseType: 'blob' }).then(res => {
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'tickets.csv');
            document.body.appendChild(link);
            link.click();
          });
        }}>
          📥 导出
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">全部状态</option>
            <option value="open">待处理</option>
            <option value="resolved">已完成</option>
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
          >
            <option value="">全部优先级</option>
            <option value="high">高优先级</option>
            <option value="normal">普通</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <h3>加载中...</h3>
          </div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <h3>暂无工单</h3>
            <p>请先运行 npm run seed 生成演示数据</p>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>运单号</th>
                  <th>收件人</th>
                  <th>当前处理人</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>{ticket.ticket_number}</td>
                    <td><Link to={`/packages/${ticket.package_id}`} className="link">{ticket.tracking_number}</Link></td>
                    <td>{ticket.receiver_name}</td>
                    <td>{ticket.current_owner || '-'}</td>
                    <td>
                      <span className={`badge ${ticket.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                        {ticket.status === 'open' ? '待处理' : '已完成'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${ticket.priority === 'high' ? 'badge-danger' : 'badge-info'}`}>
                        {ticket.priority === 'high' ? '高优先级' : '普通'}
                      </span>
                    </td>
                    <td>{new Date(ticket.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {ticket.status === 'open' && (
                          <>
                            <button
                              className="btn btn-success"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleStatusChange(ticket.id, 'resolved')}
                            >
                              完成
                            </button>
                            {ticket.priority !== 'high' && (
                              <button
                                className="btn btn-warning"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                onClick={() => handleEscalate(ticket.id)}
                              >
                                升级
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={page === pagination.page ? 'active' : ''}
                    onClick={() => setPagination(prev => ({ ...prev, page }))}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={pagination.page === totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TicketsPage;
