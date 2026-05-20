import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publishBatchesApi, statusHistoryApi, formatDate } from '../api';
import { statusColors, statusLabels, type PublishBatch, type BatchItem, type HitChange, type RollbackAudit, type StatusHistory } from '../types';

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<PublishBatch | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [hitChanges, setHitChanges] = useState<HitChange[]>([]);
  const [rollbackAudits, setRollbackAudits] = useState<RollbackAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'items' | 'changes' | 'history' | 'rollbacks'>('items');
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollback, setShowRollback] = useState(false);
  const [statusReason, setStatusReason] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    try {
      const [batchData, itemsData, historyData, changesData, auditsData] = await Promise.all([
        publishBatchesApi.get(id),
        publishBatchesApi.items(id),
        statusHistoryApi.get('publish_batch', id),
        publishBatchesApi.hitChanges(id),
        publishBatchesApi.rollbackAudits(id)
      ]);
      setBatch(batchData);
      setItems(itemsData);
      setHistory(historyData);
      setHitChanges(changesData);
      setRollbackAudits(auditsData);
    } catch (error) {
      alert('加载失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!id || !batch) return;
    try {
      await publishBatchesApi.updateStatus(id, newStatus, statusReason || undefined);
      setStatusReason('');
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error as Error).message);
    }
  }

  async function handleSimulate() {
    if (!id) return;
    setSimulating(true);
    try {
      const result = await publishBatchesApi.simulate(id);
      setSimulationResult(result);
    } catch (error) {
      alert('模拟失败: ' + (error as Error).message);
    } finally {
      setSimulating(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    if (!confirm('确认要执行发布吗？发布后将影响搜索结果。')) return;
    setPublishing(true);
    try {
      await publishBatchesApi.publish(id);
      loadData();
      alert('发布成功！');
    } catch (error) {
      alert('发布失败: ' + (error as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback() {
    if (!id || !rollbackReason.trim()) {
      alert('请输入回滚原因');
      return;
    }
    if (!confirm('确认要回滚此批次吗？这将恢复同义词到上一个版本。')) return;
    try {
      await publishBatchesApi.rollback(id, rollbackReason);
      setShowRollback(false);
      setRollbackReason('');
      loadData();
      alert('回滚成功！');
    } catch (error) {
      alert('回滚失败: ' + (error as Error).message);
    }
  }

  async function handleExport() {
    if (!id) return;
    try {
      const data = await publishBatchesApi.export(id);
      const csvContent = [
        ['批次ID', '批次名称', '批次状态', '同义词组ID', '同义词组名称', '版本', '应用范围', '同义词', '命中变化数', '平均变化率', '回滚次数', '最后状态', '最后状态原因', '状态解释说明'].join(','),
        ...data.map(item => [
          item.batch_id,
          item.batch_name,
          item.batch_status,
          item.group_id,
          item.group_name,
          item.group_version,
          item.application_scope,
          item.synonyms,
          item.hit_changes_count,
          item.hit_change_avg_percent,
          item.rollback_count,
          item.last_status,
          item.last_status_reason,
          item.status_explanation
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `发布批次_${batch?.name || id}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('导出失败: ' + (error as Error).message);
    }
  }

  function getNextStatuses(current: string): string[] {
    const transitions: Record<string, string[]> = {
      pending: ['reviewing'],
      reviewing: ['approved', 'pending'],
      approved: [],
      publishing: [],
      published: [],
      failed: ['pending'],
      rollbacking: [],
      rollbacked: ['pending']
    };
    return transitions[current] || [];
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  if (!batch) return <div style={{ padding: '40px', textAlign: 'center' }}>发布批次不存在</div>;

  const nextStatuses = getNextStatuses(batch.status);
  const canSimulate = batch.status === 'approved';
  const canPublish = batch.status === 'approved';
  const canRollback = batch.status === 'published';

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginBottom: '12px' }}>
          ← 返回列表
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>{batch.name}</h2>
            <p style={{ color: '#6b7280' }}>{batch.description || '暂无描述'}</p>
          </div>
          <span style={{ padding: '6px 16px', borderRadius: '16px', fontSize: '14px', color: 'white', background: statusColors[batch.status] }}>
            {statusLabels[batch.status]}
          </span>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>操作面板</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {nextStatuses.length > 0 && (
            <>
              <input
                type="text"
                placeholder="操作原因（可选）"
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', minWidth: '200px' }}
              />
              {nextStatuses.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'white',
                    background: status === 'approved' ? '#10b981' : '#3b82f6'
                  }}
                >
                  {status === 'reviewing' ? '开始复核' : status === 'approved' ? '通过复核' : '重新提交'}
                </button>
              ))}
            </>
          )}

          {canSimulate && (
            <button
              onClick={handleSimulate}
              disabled={simulating}
              style={{ padding: '10px 20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              {simulating ? '模拟中...' : '模拟发布（预览命中变化）'}
            </button>
          )}

          {canPublish && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {publishing ? '发布中...' : '正式发布'}
            </button>
          )}

          {canRollback && (
            <button
              onClick={() => setShowRollback(true)}
              style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              回滚
            </button>
          )}

          <button
            onClick={handleExport}
            style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', background: 'white' }}
          >
            导出数据
          </button>
        </div>

        {batch.error_message && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#fef2f2', borderRadius: '6px', color: '#dc2626' }}>
            <strong>发布失败:</strong> {batch.error_message}
          </div>
        )}

        {simulationResult && (
          <div style={{ marginTop: '16px', padding: '16px', background: simulationResult.success ? '#f0fdf4' : '#fef2f2', borderRadius: '6px' }}>
            <h4 style={{ marginBottom: '12px', color: simulationResult.success ? '#166534' : '#991b1b' }}>
              模拟发布结果: {simulationResult.success ? '通过 ✓' : '拦截 ✗'}
            </h4>
            {simulationResult.errors && (
              <div style={{ marginBottom: '12px', color: '#dc2626' }}>
                {simulationResult.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
              </div>
            )}
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>共 {simulationResult.changes?.length || 0} 个查询命中变化</p>
            
            {simulationResult.changes && simulationResult.changes.length > 0 && (
              <div style={{ marginTop: '16px', overflow: 'auto' }}>
                <h5 style={{ marginBottom: '12px', fontWeight: 600 }}>命中明细对比</h5>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.05)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>查询词</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>发布前命中</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>发布后命中</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>变化量</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>变化率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.changes.map((change: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{change.query}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{change.hits_before}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{change.hits_after}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ color: change.hits_after - change.hits_before < 0 ? '#ef4444' : '#10b981' }}>
                            {change.hits_after - change.hits_before > 0 ? '+' : ''}{change.hits_after - change.hits_before}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ 
                            color: change.change_percent < 0 ? '#ef4444' : '#10b981',
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: change.change_percent < -20 ? '#fee2e2' : change.change_percent < 0 ? '#fef3c7' : '#dcfce7'
                          }}>
                            {change.change_percent > 0 ? '+' : ''}{change.change_percent.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
                  <span style={{ display: 'inline-block', marginRight: '16px' }}>🔴 红色 = 命中下降超过 20%</span>
                  <span style={{ display: 'inline-block' }}>🟡 黄色 = 命中下降 0-20%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {showRollback && (
          <div style={{ marginTop: '16px', padding: '16px', background: '#fef2f2', borderRadius: '6px' }}>
            <h4 style={{ marginBottom: '12px' }}>确认回滚</h4>
            <input
              type="text"
              placeholder="请输入回滚原因"
              value={rollbackReason}
              onChange={e => setRollbackReason(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRollback(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={handleRollback} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                确认回滚
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        {(['items', 'changes', 'history', 'rollbacks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab ? '#3b82f6' : '#374151'
            }}
          >
            {tab === 'items' ? '同义词组' : tab === 'changes' ? '命中变化' : tab === 'history' ? '状态变更' : '回滚记录'}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {activeTab === 'items' && (
          <div>
            {items.map(item => (
              <div key={item.id} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '4px' }}>{item.group_name}</p>
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>版本: v{item.version}</p>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: 'white', background: statusColors[item.status] }}>
                  {statusLabels[item.status]}
                </span>
              </div>
            ))}
            {items.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>暂无数据</div>}
          </div>
        )}

        {activeTab === 'changes' && (
          <div>
            {hitChanges.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>暂无命中变化数据</div>
            ) : (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>查询词</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>发布前命中</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>发布后命中</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>变化率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hitChanges.map(change => (
                      <tr key={change.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{change.query}</td>
                        <td style={{ padding: '12px' }}>{change.hits_before}</td>
                        <td style={{ padding: '12px' }}>{change.hits_after}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: change.change_percent < 0 ? '#ef4444' : '#10b981' }}>
                            {change.change_percent > 0 ? '+' : ''}{change.change_percent.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {history.map(h => (
              <div key={h.id} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>
                    <span style={{ fontWeight: 600 }}>
                      {h.from_status ? `${statusLabels[h.from_status] || h.from_status} → ` : ''}
                      {statusLabels[h.to_status] || h.to_status}
                    </span>
                    {h.reason && <span style={{ color: '#6b7280', marginLeft: '8px' }}>（{h.reason}）</span>}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>{formatDate(h.created_at)}</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>操作人: {h.created_by}</p>
              </div>
            ))}
            {history.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>暂无状态变更记录</div>}
          </div>
        )}

        {activeTab === 'rollbacks' && (
          <div>
            {rollbackAudits.map(audit => (
              <div key={audit.id} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600 }}>v{audit.rollback_from_version} → v{audit.rollback_to_version}</span>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>{formatDate(audit.created_at)}</span>
                </div>
                <p style={{ marginBottom: '4px' }}><strong>回滚原因:</strong> {audit.reason}</p>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>操作人: {audit.created_by}</p>
              </div>
            ))}
            {rollbackAudits.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>暂无回滚记录</div>}
          </div>
        )}
      </div>
    </div>
  );
}
