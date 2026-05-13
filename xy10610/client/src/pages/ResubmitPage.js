import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const ResubmitPage = () => {
  const [resubmissions, setResubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ review_status: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  useEffect(() => {
    fetchResubmissions();
  }, [pagination.page, filters]);

  const fetchResubmissions = async () => {
    try {
      setLoading(true);
      const params = { ...filters, page: pagination.page, limit: pagination.limit };
      const res = await axios.get('/api/resubmit', { params });
      setResubmissions(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (err) {
      console.error('获取重提列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await axios.put(`/api/resubmit/${id}/review`, {
        review_status: status,
        reviewed_by: '当前用户',
        notes: status === 'approved' ? '审核通过，同意重提' : '审核拒绝'
      });
      fetchResubmissions();
    } catch (err) {
      console.error('审核失败:', err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning">待审核</span>;
      case 'approved':
        return <span className="badge badge-success">已通过</span>;
      case 'rejected':
        return <span className="badge badge-danger">已拒绝</span>;
      default:
        return status;
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">退单重提</h1>
      </div>

      <div className="card">
        <div className="filter-bar">
          <select
            value={filters.review_status}
            onChange={(e) => setFilters(prev => ({ ...prev, review_status: e.target.value }))}
          >
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <h3>加载中...</h3>
          </div>
        ) : resubmissions.length === 0 ? (
          <div className="empty-state">
            <h3>暂无重提申请</h3>
            <p>请先运行 npm run seed 生成演示数据</p>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>运单号</th>
                  <th>收件人</th>
                  <th>申报价值</th>
                  <th>原因</th>
                  <th>审核状态</th>
                  <th>审核人</th>
                  <th>申请时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {resubmissions.map(rs => (
                  <tr key={rs.id}>
                    <td><Link to={`/packages/${rs.package_id}`} className="link">{rs.tracking_number}</Link></td>
                    <td>{rs.receiver_name}</td>
                    <td>{rs.declared_value} USD</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rs.reason}</td>
                    <td>{getStatusBadge(rs.review_status)}</td>
                    <td>{rs.reviewed_by || '-'}</td>
                    <td>{new Date(rs.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      {rs.review_status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-success"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleReview(rs.id, 'approved')}
                          >
                            通过
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleReview(rs.id, 'rejected')}
                          >
                            拒绝
                          </button>
                        </div>
                      )}
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

export default ResubmitPage;
