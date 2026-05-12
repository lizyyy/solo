import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tenantApi, diffApi, taskApi, callbackApi } from '../api';
import { Modal } from '../components/Modal';
import { statusLabels, statusColors, diffTypeLabels, formatDate } from '../utils';
import type { TenantDetail, Diff, Callback, Task } from '../types';

export function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'retry' | 'business'>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<Diff | null>(null);
  const [diffStatus, setDiffStatus] = useState('confirmed');
  const [diffConclusion, setDiffConclusion] = useState('');
  const [importEnv, setImportEnv] = useState<'old' | 'new'>('old');
  const [importJson, setImportJson] = useState('');
  const [processing, setProcessing] = useState(false);
  const [validating, setValidating] = useState(false);

  const loadTenant = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await tenantApi.getById(id);
      setTenant(response.data);
    } catch (err) {
      setError('加载租户详情失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
  }, [id]);

  const handleImportSnapshot = async () => {
    if (!id) return;

    try {
      let parsedData;
      try {
        parsedData = JSON.parse(importJson);
      } catch (e) {
        setError('JSON格式错误');
        return;
      }

      setProcessing(true);
      await tenantApi.importSnapshot(id, {
        environment: importEnv,
        data: parsedData
      });
      setShowImportModal(false);
      setImportJson('');
      setError(null);
      loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || '导入快照失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleValidate = async () => {
    if (!id) return;

    try {
      setValidating(true);
      await tenantApi.validate(id);
      loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || '校验失败');
    } finally {
      setValidating(false);
    }
  };

  const handleOpenDiffModal = (diff: Diff) => {
    setSelectedDiff(diff);
    setDiffStatus('confirmed');
    setDiffConclusion(diff.conclusion || '');
    setShowDiffModal(true);
  };

  const handleConfirmDiff = async () => {
    if (!selectedDiff) return;

    try {
      setProcessing(true);
      await diffApi.confirm(selectedDiff.id, {
        status: diffStatus,
        conclusion: diffConclusion
      });
      setShowDiffModal(false);
      loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || '确认差异失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleFreezeTask = async (taskId: string, freeze: boolean) => {
    if (!id) return;

    try {
      if (freeze) {
        await taskApi.freeze(taskId);
      } else {
        await taskApi.unfreeze(taskId);
      }
      loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  const handleSwitchCallback = async (callbackId: string) => {
    if (!id) return;

    try {
      setProcessing(true);
      await callbackApi.switch(callbackId);
      loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || '切换回调失败');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!tenant) {
    return <div className="alert alert-error">租户不存在</div>;
  }

  const filteredDiffs = tenant.diffs.filter(diff => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return diff.status === 'pending';
    if (activeTab === 'retry') return diff.status === 'retry';
    if (activeTab === 'business') return diff.status === 'business_decision';
    return true;
  });

  const hasOldSnapshot = tenant.snapshots.some(s => s.environment === 'old');
  const hasNewSnapshot = tenant.snapshots.some(s => s.environment === 'new');
  const canValidate = hasOldSnapshot && hasNewSnapshot;

  const pendingCount = tenant.diffs.filter(d => d.status === 'pending').length;
  const retryCount = tenant.diffs.filter(d => d.status === 'retry').length;
  const businessCount = tenant.diffs.filter(d => d.status === 'business_decision').length;
  const unswitchedCount = tenant.callbacks.filter(c => c.is_switched === 0).length;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/">批次列表</Link> / 
        <Link to={`/batches/${tenant.batch_id}`}> 批次详情</Link> / 
        {tenant.tenant_name}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              {tenant.tenant_name}
              <span className={`badge badge-${statusColors[tenant.status]}`} style={{ marginLeft: '10px' }}>
                {statusLabels[tenant.status]}
              </span>
            </h2>
            <div style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
              租户ID: {tenant.tenant_id} | 创建时间: {formatDate(tenant.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-primary"
              onClick={() => setShowImportModal(true)}
            >
              导入快照
            </button>
            <button 
              className="btn btn-success"
              onClick={handleValidate}
              disabled={!canValidate || validating}
            >
              {validating ? '校验中...' : '重新校验'}
            </button>
          </div>
        </div>

        <div className="tenant-summary">
          <div className="tenant-summary-item">
            <div className="count" style={{ color: '#ffc107' }}>{pendingCount}</div>
            <div className="label">待处理差异</div>
          </div>
          <div className="tenant-summary-item">
            <div className="count" style={{ color: '#17a2b8' }}>{retryCount}</div>
            <div className="label">待重试</div>
          </div>
          <div className="tenant-summary-item">
            <div className="count" style={{ color: '#dc3545' }}>{businessCount}</div>
            <div className="label">需业务决定</div>
          </div>
          <div className="tenant-summary-item">
            <div className="count" style={{ color: unswitchedCount > 0 ? '#dc3545' : '#28a745' }}>
              {unswitchedCount}
            </div>
            <div className="label">未切换回调</div>
          </div>
          <div className="tenant-summary-item">
            <div className="count" style={{ color: hasOldSnapshot ? '#28a745' : '#ffc107' }}>
              {hasOldSnapshot ? '✓' : '✗'}
            </div>
            <div className="label">旧环境快照</div>
          </div>
          <div className="tenant-summary-item">
            <div className="count" style={{ color: hasNewSnapshot ? '#28a745' : '#ffc107' }}>
              {hasNewSnapshot ? '✓' : '✗'}
            </div>
            <div className="label">新环境快照</div>
          </div>
        </div>

        {!canValidate && (
          <div className="alert alert-warning">
            <strong>提示：</strong>请先导入旧环境和新环境的快照，然后进行校验。
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">差异处理</h2>
        </div>

        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部 ({tenant.diffs.length})
          </div>
          <div 
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            待处理 ({pendingCount})
          </div>
          <div 
            className={`tab ${activeTab === 'retry' ? 'active' : ''}`}
            onClick={() => setActiveTab('retry')}
          >
            待重试 ({retryCount})
          </div>
          <div 
            className={`tab ${activeTab === 'business' ? 'active' : ''}`}
            onClick={() => setActiveTab('business')}
          >
            需业务决定 ({businessCount})
          </div>
        </div>

        {filteredDiffs.length === 0 ? (
          <div className="empty">暂无差异记录</div>
        ) : (
          <div>
            {filteredDiffs.map((diff: Diff) => (
              <div 
                key={diff.id} 
                className={`diff-item ${diff.status}`}
              >
                <div className="diff-content">
                  <div className="diff-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <strong>{diffTypeLabels[diff.type]}</strong>
                      <span className={`badge badge-${statusColors[diff.status]}`}>
                        {statusLabels[diff.status]}
                      </span>
                      {diff.has_manual_conclusion === 1 && (
                        <span className="badge badge-info">人工处理</span>
                      )}
                    </div>
                    <div style={{ color: '#666' }}>{diff.conclusion}</div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                      更新时间: {formatDate(diff.updated_at)}
                    </div>
                  </div>
                  <div className="diff-actions">
                    {diff.status !== 'confirmed' && (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleOpenDiffModal(diff)}
                      >
                        处理
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">定时任务</h2>
        </div>

        {tenant.tasks.length === 0 ? (
          <div className="empty">暂无定时任务</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>任务类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tenant.tasks.map((task: Task) => (
                <tr key={task.id}>
                  <td>{task.task_name}</td>
                  <td>{task.task_type}</td>
                  <td>
                    <span className={`badge badge-${task.is_frozen ? 'warning' : 'success'}`}>
                      {task.is_frozen ? '已冻结' : '正常'}
                    </span>
                  </td>
                  <td>
                    {task.is_frozen ? (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleFreezeTask(task.id, false)}
                      >
                        恢复
                      </button>
                    ) : (
                      <button 
                        className="btn btn-sm btn-warning"
                        onClick={() => handleFreezeTask(task.id, true)}
                      >
                        冻结
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">回调地址</h2>
        </div>

        {tenant.callbacks.length === 0 ? (
          <div className="empty">暂无回调地址</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>服务名称</th>
                <th>旧地址</th>
                <th>新地址</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tenant.callbacks.map((callback: Callback) => (
                <tr key={callback.id}>
                  <td>{callback.service_name}</td>
                  <td style={{ fontSize: '12px', maxWidth: '300px', wordBreak: 'break-all' }}>
                    {callback.old_url}
                  </td>
                  <td style={{ fontSize: '12px', maxWidth: '300px', wordBreak: 'break-all' }}>
                    {callback.new_url}
                  </td>
                  <td>
                    <span className={`badge badge-${callback.is_switched ? 'success' : 'danger'}`}>
                      {callback.is_switched ? '已切换' : '未切换'}
                    </span>
                  </td>
                  <td>
                    {!callback.is_switched && callback.old_url !== callback.new_url && (
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSwitchCallback(callback.id)}
                        disabled={processing}
                      >
                        切换
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="导入校验快照"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImportSnapshot}
              disabled={processing || !importJson.trim()}
            >
              {processing ? '导入中...' : '导入'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">环境 *</label>
          <select 
            className="form-select"
            value={importEnv}
            onChange={(e) => setImportEnv(e.target.value as 'old' | 'new')}
          >
            <option value="old">旧环境</option>
            <option value="new">新环境</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">快照数据 (JSON) *</label>
          <textarea
            className="form-textarea"
            placeholder='{"dataCount": 1000, "permissions": ["read"], "tasks": [], "callbacks": []}'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            style={{ fontFamily: 'Monaco, Menlo, monospace', fontSize: '12px' }}
          />
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            格式示例: dataCount (数据量), permissions (权限列表), tasks (定时任务), callbacks (回调地址)
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        title={`处理${selectedDiff ? diffTypeLabels[selectedDiff.type] : ''}差异`}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowDiffModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmDiff}
              disabled={processing}
            >
              {processing ? '确认中...' : '确认'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">处理状态 *</label>
          <select 
            className="form-select"
            value={diffStatus}
            onChange={(e) => setDiffStatus(e.target.value)}
          >
            <option value="confirmed">已确认无问题</option>
            <option value="retry">待重试校验</option>
            <option value="business_decision">需业务决定</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">处理说明</label>
          <textarea
            className="form-textarea"
            placeholder="请说明处理情况..."
            value={diffConclusion}
            onChange={(e) => setDiffConclusion(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
