import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { batchApi } from '../api';
import { Modal } from '../components/Modal';
import { statusLabels, statusColors, formatDate } from '../utils';
import type { Batch } from '../types';

export function BatchList() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDesc, setNewBatchDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const response = await batchApi.getAll();
      setBatches(response.data);
    } catch (err) {
      setError('加载批次列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) return;

    try {
      setCreating(true);
      await batchApi.create({ name: newBatchName, description: newBatchDesc });
      setShowCreateModal(false);
      setNewBatchName('');
      setNewBatchDesc('');
      loadBatches();
    } catch (err) {
      setError('创建批次失败');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">迁移批次列表</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新建批次
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {batches.length === 0 ? (
          <div className="empty">暂无迁移批次，点击右上角新建</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>批次名称</th>
                <th>状态</th>
                <th>租户总数</th>
                <th>已通过</th>
                <th>失败</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <Link to={`/batches/${batch.id}`} className="link">
                      {batch.name}
                    </Link>
                    {batch.description && (
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        {batch.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${statusColors[batch.status]}`}>
                      {statusLabels[batch.status]}
                    </span>
                  </td>
                  <td>{batch.tenant_count || 0}</td>
                  <td>{batch.passed_count || 0}</td>
                  <td>{batch.failed_count || 0}</td>
                  <td>{formatDate(batch.created_at)}</td>
                  <td>
                    <Link to={`/batches/${batch.id}`} className="btn btn-primary btn-sm">
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新建迁移批次"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreateModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateBatch}
              disabled={creating || !newBatchName.trim()}
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">批次名称 *</label>
          <input
            type="text"
            className="form-input"
            placeholder="例如：2026年5月批次"
            value={newBatchName}
            onChange={(e) => setNewBatchName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">描述</label>
          <textarea
            className="form-textarea"
            placeholder="可选，描述本次迁移的背景和范围"
            value={newBatchDesc}
            onChange={(e) => setNewBatchDesc(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
