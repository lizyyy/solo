import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const PackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', tracking_number: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  useEffect(() => {
    fetchPackages();
  }, [pagination.page, filters]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const params = { ...filters, page: pagination.page, limit: pagination.limit };
      const res = await axios.get('/api/packages', { params });
      setPackages(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (err) {
      console.error('获取包裹列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    try {
      const params = { ...filters, format };
      const res = await axios.get('/api/export/packages', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `packages.${format}`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error('导出失败:', err);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: '待处理',
      cleared: '已清关',
      supplement_required: '需补资料',
      supplement_completed: '资料已补',
      returned: '已退单',
      resubmitted: '已重提',
      failed: '清关失败',
      tax_adjusted: '税费已调整'
    };
    return labels[status] || status;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">包裹管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => handleExport('csv')}>
            📥 导出 CSV
          </button>
          <button className="btn btn-success" onClick={() => handleExport('json')}>
            📄 导出 JSON
          </button>
        </div>
      </div>

      <div className="card">
        <div className="alert alert-info">
          <strong>演示数据说明：</strong>系统内置四条演示路径数据
          <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
            <li>DEMO-SUCCESS-001：清关成功路径</li>
            <li>DEMO-BLOCKED-001：清关拦截路径（需补资料）</li>
            <li>DEMO-CORRECT-001：人工修正路径（退单重提）</li>
            <li>DEMO-DUPLICATE-001：幂等性演示（重复提交）</li>
          </ul>
        </div>

        <div className="filter-bar">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="cleared">已清关</option>
            <option value="supplement_required">需补资料</option>
            <option value="returned">已退单</option>
            <option value="failed">清关失败</option>
          </select>
          <input
            type="text"
            placeholder="搜索运单号..."
            value={filters.tracking_number}
            onChange={(e) => setFilters(prev => ({ ...prev, tracking_number: e.target.value }))}
          />
        </div>

        {loading ? (
          <div className="empty-state">
            <h3>加载中...</h3>
          </div>
        ) : packages.length === 0 ? (
          <div className="empty-state">
            <h3>暂无数据</h3>
            <p>请先运行 npm run seed 生成演示数据</p>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>运单号</th>
                  <th>发件人</th>
                  <th>收件人</th>
                  <th>重量</th>
                  <th>申报价值</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {packages.map(pkg => (
                  <tr key={pkg.id}>
                    <td><Link to={`/packages/${pkg.id}`} className="link">{pkg.tracking_number}</Link></td>
                    <td>{pkg.sender_name}</td>
                    <td>{pkg.receiver_name}</td>
                    <td>{pkg.weight} kg</td>
                    <td>{pkg.declared_value} {pkg.currency}</td>
                    <td><span className={`badge status-${pkg.status}`}>{getStatusLabel(pkg.status)}</span></td>
                    <td>{new Date(pkg.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <Link to={`/packages/${pkg.id}`} className="link">查看详情</Link>
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

export default PackagesPage;
