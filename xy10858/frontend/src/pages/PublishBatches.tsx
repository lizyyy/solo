import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { publishBatchesApi, synonymGroupsApi, formatDate } from '../api';
import { statusColors, statusLabels, type PublishBatch, type SynonymGroup } from '../types';

export default function PublishBatches() {
  const [batches, setBatches] = useState<PublishBatch[]>([]);
  const [allGroups, setAllGroups] = useState<SynonymGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', selectedGroups: [] as string[] });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [batchesData, groupsData] = await Promise.all([
        publishBatchesApi.list(),
        synonymGroupsApi.list()
      ]);
      setBatches(batchesData);
      setAllGroups(groupsData.filter(g => g.status === 'approved'));
    } catch (error) {
      alert('加载失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (formData.selectedGroups.length === 0) {
      alert('请至少选择一个同义词组');
      return;
    }
    try {
      await publishBatchesApi.create({
        name: formData.name,
        description: formData.description,
        groupIds: formData.selectedGroups
      });
      setShowCreate(false);
      setFormData({ name: '', description: '', selectedGroups: [] });
      loadData();
    } catch (error) {
      alert('创建失败: ' + (error as Error).message);
    }
  }

  function toggleGroup(groupId: string) {
    setFormData(prev => ({
      ...prev,
      selectedGroups: prev.selectedGroups.includes(groupId)
        ? prev.selectedGroups.filter(id => id !== groupId)
        : [...prev.selectedGroups, groupId]
    }));
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>发布批次管理</h2>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          + 新建发布批次
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>新建发布批次</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>批次名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>描述</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '80px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>选择同义词组（状态为"已审批"的可发布）</label>
              {allGroups.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '14px' }}>暂无已审批的同义词组</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflow: 'auto' }}>
                  {allGroups.map(group => (
                    <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#f9fafb', borderRadius: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.selectedGroups.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                      />
                      <span style={{ fontWeight: 500 }}>{group.name}</span>
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>({group.synonyms.length} 个同义词)</span>
                    </label>
                  ))}
                </div>
              )}
              <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>已选择 {formData.selectedGroups.length} 个</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                取消
              </button>
              <button type="submit" style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                创建
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>批次名称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>创建人</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>审批人</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>发布时间</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>创建时间</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(batch => (
              <tr key={batch.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  <div>
                    {batch.name}
                    {batch.description && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, marginTop: '4px' }}>{batch.description}</p>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: 'white', background: statusColors[batch.status] }}>
                    {statusLabels[batch.status]}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>{batch.created_by}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{batch.approved_by || '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                  {batch.published_at ? formatDate(batch.published_at) : '-'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{formatDate(batch.created_at)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <Link to={`/batches/${batch.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>查看详情</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {batches.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>暂无数据</div>
        )}
      </div>
    </div>
  );
}
