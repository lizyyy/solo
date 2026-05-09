import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi, anomalyApi, importExportApi } from './services/api';
import { formatDate, generateOrderNo } from './utils';
import { STATUS_LABELS, STATUS_COLORS, SEVERITY_LABELS } from './types';
import type { ReworkOrder, StatsSummary, Anomaly } from './types';
import { Toast, showToast } from './components/Toast';
import { OrderFormModal } from './components/OrderFormModal';
import { ImportModal } from './components/ImportModal';

export default function App() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ReworkOrder[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);

  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
    start_date: '',
    end_date: ''
  });

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await orderApi.list({ ...filters, page, page_size: pageSize });
      setOrders(result.data);
      setTotal(result.total);
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await orderApi.stats();
      setStats(s);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  const handleSearch = () => {
    setPage(1);
    setTimeout(fetchList, 0);
  };

  const handleReset = () => {
    setFilters({ keyword: '', status: '', start_date: '', end_date: '' });
    setPage(1);
    setTimeout(fetchList, 0);
  };

  const handleCreateOrder = async (data: any) => {
    try {
      await orderApi.create(data);
      setShowOrderForm(false);
      showToast('创建成功', 'success');
      fetchList();
      fetchStats();
    } catch (e: any) {
      showToast(e.message || '创建失败', 'error');
    }
  };

  const handleDelete = async (order: ReworkOrder) => {
    if (!confirm(`确定要删除返工单 ${order.order_no} 吗？此操作会删除所有相关记录。`)) return;
    try {
      await orderApi.remove(order.id);
      showToast('已删除', 'success');
      fetchList();
      fetchStats();
    } catch (e: any) {
      showToast(e.message || '删除失败', 'error');
    }
  };

  const handleClose = async (order: ReworkOrder) => {
    const note = prompt('请输入关闭备注：', '手动关闭工单');
    if (note === null) return;
    try {
      await orderApi.close(order.id, { close_note: note });
      showToast('工单已闭环', 'success');
      fetchList();
      fetchStats();
    } catch (e: any) {
      showToast(e.message || '关闭失败', 'error');
    }
  };

  const handleExport = () => {
    importExportApi.exportOrders();
    showToast('正在导出...', 'info');
  };

  const handleImport = async (file: File) => {
    try {
      const result = await importExportApi.importOrders(file);
      showToast(`导入成功: ${result.imported} 条，失败: ${result.failed} 条`, result.failed > 0 ? 'warning' : 'success');
      if (result.errors?.length) {
        alert('导入失败详情：\n' + result.errors.slice(0, 5).join('\n'));
      }
      setShowImport(false);
      fetchList();
      fetchStats();
    } catch (e: any) {
      showToast(e.message || '导入失败', 'error');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container">
      <Toast />
      
      <div className="page-header">
        <h1 className="page-title">工厂返工单质量闭环台</h1>
        <p className="page-subtitle">追踪返工全流程，记录原因、责任工序、质检结论，确保数据不散失、质量可追溯</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">返工单总数</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">待处理</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{stats.in_progress}</div>
            <div className="stat-label">返工中</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.closed}</div>
            <div className="stat-label">已闭环</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-value">{stats.open_anomalies}</div>
            <div className="stat-label">未解决异常</div>
          </div>
        </div>
      )}

      {stats?.high_rework_orders?.length > 0 && (
        <div className="alert alert-danger">
          <span>⚠️</span>
          <div>
            <strong>高风险预警：</strong>以下工单返工次数 ≥ 2 次，请重点关注
            <div style={{ marginTop: 4 }}>
              {stats.high_rework_orders.map(o => (
                <span key={o.id} className="tag" style={{ background: '#fff1f0', color: '#cf1322', cursor: 'pointer' }} onClick={() => navigate(`/orders/${o.id}`)}>
                  {o.order_no} ({o.rework_count || 0}次)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-row" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>关键词</label>
            <input
              className="form-control"
              placeholder="单号/产品/批次"
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="form-group">
            <label>状态</label>
            <select
              className="form-control"
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="in_progress">返工中</option>
              <option value="closed">已闭环</option>
            </select>
          </div>
          <div className="form-group">
            <label>开始日期</label>
            <input
              type="date"
              className="form-control"
              value={filters.start_date}
              onChange={e => setFilters({ ...filters, start_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>结束日期</label>
            <input
              type="date"
              className="form-control"
              value={filters.end_date}
              onChange={e => setFilters({ ...filters, end_date: e.target.value })}
            />
          </div>
        </div>
        <div className="filter-row" style={{ justifyContent: 'space-between' }}>
          <div className="button-group">
            <button className="btn btn-primary" onClick={handleSearch}>🔍 查询</button>
            <button className="btn btn-secondary" onClick={handleReset}>重置</button>
          </div>
          <div className="button-group">
            <button className="btn btn-outline" onClick={() => setShowImport(true)}>📥 导入</button>
            <button className="btn btn-outline" onClick={handleExport}>📤 导出</button>
            <button className="btn btn-primary" onClick={() => setShowOrderForm(true)}>+ 新建返工单</button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>返工单号</th>
                <th>产品名称</th>
                <th>批次号</th>
                <th>批量</th>
                <th>不良数</th>
                <th>返工次数</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}>加载中...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-text">暂无返工单数据</div>
                </td></tr>
              ) : orders.map(order => (
                <tr key={order.id}>
                  <td><a onClick={() => navigate(`/orders/${order.id}`)} style={{ cursor: 'pointer', fontWeight: 500 }}>{order.order_no}</a></td>
                  <td>{order.product_name}</td>
                  <td>{order.batch_no || '-'}</td>
                  <td>{order.qty || 0}</td>
                  <td>{order.defect_qty || 0}</td>
                  <td>
                    <span className="status-badge status-info">{order.rework_count || 0} 次</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${STATUS_COLORS[order.current_status]}`}>
                      {STATUS_LABELS[order.current_status]}
                    </span>
                  </td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>
                    <div className="button-group">
                      <button className="btn btn-sm btn-outline" onClick={() => navigate(`/orders/${order.id}`)}>详情</button>
                      {order.current_status !== 'closed' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleClose(order)}>闭环</button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(order)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="page-info">共 {total} 条，第 {page} / {totalPages || 1} 页</div>
          <div className="page-buttons">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 5) {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                p = start + i;
              }
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
          </div>
        </div>
      </div>

      {showOrderForm && (
        <OrderFormModal
          initialData={{ order_no: generateOrderNo() }}
          onSubmit={handleCreateOrder}
          onClose={() => setShowOrderForm(false)}
        />
      )}

      {showImport && (
        <ImportModal
          onSubmit={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
