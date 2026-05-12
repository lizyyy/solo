import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { batchApi, tenantApi } from '../api';
import { Modal } from '../components/Modal';
import { statusLabels, statusColors, formatDate } from '../utils';
import type { BatchDetail, Tenant } from '../types';

export function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState(false);

  const loadBatch = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await batchApi.getById(id);
      setBatch(response.data);
    } catch (err) {
      setError('加载批次详情失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatch();
  }, [id]);

  const handleAddTenant = async () => {
    if (!id || !newTenantId.trim() || !newTenantName.trim()) return;

    try {
      setAdding(true);
      await tenantApi.addToBatch(id, {
        tenantId: newTenantId,
        tenantName: newTenantName
      });
      setShowAddTenantModal(false);
      setNewTenantId('');
      setNewTenantName('');
      loadBatch();
    } catch (err) {
      setError('添加租户失败');
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleCloseBatch = async () => {
    if (!id) return;

    try {
      setClosing(true);
      await batchApi.close(id);
      setShowCloseModal(false);
      loadBatch();
    } catch (err: any) {
      setError(err.response?.data?.error || '关闭批次失败');
    } finally {
      setClosing(false);
    }
  };

  const canClose = batch && batch.status !== 'closed' &&
    (!batch.tenants.some(t => 
      (t.pending_diffs || 0) > 0 || 
      (t.retry_diffs || 0) > 0 || 
      (t.business_diffs || 0) > 0 || 
      (t.unswitched_callbacks || 0) > 0
    ));

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!batch) {
    return <div className="alert alert-error">批次不存在</div>;
  }

  const totalTenants = batch.tenants.length;
  const passedTenants = batch.tenants.filter(t => t.status === 'passed').length;
  const progress = totalTenants > 0 ? (passedTenants / totalTenants) * 100 : 0;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">批次列表</Link> / {batch.name}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{batch.name}</h2>
            <span className={`badge badge-${statusColors[batch.status]}`} style={{ marginTop: '8px', display: 'inline-block' }}>
              {statusLabels[batch.status]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {batch.status !== 'closed' && (
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddTenantModal(true)}
              >
                + 添加租户
              </button>
            )}
            {batch.status === 'in_progress' && canClose && (
              <button 
                className="btn btn-success"
                onClick={() => setShowCloseModal(true)}
              >
                关闭批次
              </button>
            )}
            <a
              href={`/api/batches/${id}/report`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              导出报告
            </a>
          </div>
        </div>

        {batch.description && (
          <p style={{ color: '#666', marginBottom: '20px' }}>{batch.description}</p>
        )}

        <div className="progress-bar" style={{ marginBottom: '20px' }}>
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-text">
          进度: {passedTenants}/{totalTenants} 个租户通过 ({Math.round(progress)}%)
        </div>

        <div className="stats-grid" style={{ marginTop: '20px' }}>
          <div className="stat-card">
            <div className="stat-value">{totalTenants}</div>
            <div className="stat-label">租户总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#28a745' }}>{passedTenants}</div>
            <div className="stat-label">已通过</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ffc107' }}>
              {batch.tenants.filter(t => t.status === 'in_progress').length}
            </div>
            <div className="stat-label">进行中</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#dc3545' }}>
              {batch.tenants.filter(t => t.status === 'failed').length}
            </div>
            <div className="stat-label">失败</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">租户列表</h2>
        </div>

        {batch.tenants.length === 0 ? (
          <div className="empty">暂无租户，点击上方添加</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>租户ID</th>
                <th>租户名称</th>
                <th>状态</th>
                <th>待处理差异</th>
                <th>待重试</th>
                <th>需业务决定</th>
                <th>未切换回调</th>
                <th>冻结任务</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {batch.tenants.map((tenant: Tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.tenant_id}</td>
                  <td>{tenant.tenant_name}</td>
                  <td>
                    <span className={`badge badge-${statusColors[tenant.status]}`}>
                      {statusLabels[tenant.status]}
                    </span>
                  </td>
                  <td>
                    {(tenant.pending_diffs || 0) > 0 ? (
                      <span className="badge badge-warning">{tenant.pending_diffs}</span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    {(tenant.retry_diffs || 0) > 0 ? (
                      <span className="badge badge-info">{tenant.retry_diffs}</span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    {(tenant.business_diffs || 0) > 0 ? (
                      <span className="badge badge-danger">{tenant.business_diffs}</span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    {(tenant.unswitched_callbacks || 0) > 0 ? (
                      <span className="badge badge-danger">{tenant.unswitched_callbacks}</span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    {(tenant.frozen_tasks || 0) > 0 ? (
                      <span className="badge badge-warning">{tenant.frozen_tasks}</span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/tenants/${tenant.id}`} className="btn btn-primary btn-sm">
                      处理
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={showAddTenantModal}
        onClose={() => setShowAddTenantModal(false)}
        title="添加租户"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAddTenantModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddTenant}
              disabled={adding || !newTenantId.trim() || !newTenantName.trim()}
            >
              {adding ? '添加中...' : '添加'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">租户ID *</label>
          <input
            type="text"
            className="form-input"
            placeholder="例如：T001"
            value={newTenantId}
            onChange={(e) => setNewTenantId(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">租户名称 *</label>
          <input
            type="text"
            className="form-input"
            placeholder="例如：科技公司A"
            value={newTenantName}
            onChange={(e) => setNewTenantName(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="关闭批次"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCloseModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-success"
              onClick={handleCloseBatch}
              disabled={closing}
            >
              {closing ? '关闭中...' : '确认关闭'}
            </button>
          </>
        }
      >
        <div className="alert alert-warning">
          <strong>注意：</strong>关闭批次后，所有租户将标记为已通过。请确保：
        </div>
        <ul className="checklist">
          <li>
            <span className="checkbox checked">✓</span>
            所有差异已确认或处理
          </li>
          <li>
            <span className="checkbox checked">✓</span>
            所有回调地址已切换
          </li>
          <li>
            <span className="checkbox checked">✓</span>
            没有待重试或待业务决定的项目
          </li>
        </ul>
      </Modal>
    </div>
  );
}
