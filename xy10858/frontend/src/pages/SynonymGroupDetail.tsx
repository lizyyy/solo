import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { synonymGroupsApi, statusHistoryApi, formatDate } from '../api';
import { statusColors, statusLabels, type SynonymGroup, type SynonymVersion, type StatusHistory, type TestQuery } from '../types';

export default function SynonymGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<SynonymGroup | null>(null);
  const [versions, setVersions] = useState<SynonymVersion[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [testQueries, setTestQueries] = useState<TestQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'versions' | 'history' | 'tests'>('info');
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null);
  const [newTestQuery, setNewTestQuery] = useState('');
  const [statusReason, setStatusReason] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    try {
      const [groupData, versionsData, historyData, testQueriesData] = await Promise.all([
        synonymGroupsApi.get(id),
        synonymGroupsApi.versions(id),
        statusHistoryApi.get('synonym_group', id),
        synonymGroupsApi.testQueries(id)
      ]);
      setGroup(groupData);
      setVersions(versionsData);
      setHistory(historyData);
      setTestQueries(testQueriesData);
    } catch (error) {
      alert('加载失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!id || !group) return;
    try {
      await synonymGroupsApi.updateStatus(id, newStatus, statusReason || undefined);
      setStatusReason('');
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error as Error).message);
    }
  }

  async function addTestQuery() {
    if (!id || !newTestQuery.trim()) return;
    try {
      await synonymGroupsApi.addTestQuery(id, newTestQuery.trim());
      setNewTestQuery('');
      loadData();
    } catch (error) {
      alert('添加失败: ' + (error as Error).message);
    }
  }

  function getNextStatuses(current: string): string[] {
    const transitions: Record<string, string[]> = {
      draft: ['pending_review'],
      pending_review: ['approved', 'rejected', 'draft'],
      approved: [],
      published: [],
      rejected: ['draft'],
      rollbacked: ['draft']
    };
    return transitions[current] || [];
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  if (!group) return <div style={{ padding: '40px', textAlign: 'center' }}>同义词组不存在</div>;

  const nextStatuses = getNextStatuses(group.status);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginBottom: '12px' }}>
          ← 返回列表
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>{group.name}</h2>
            <p style={{ color: '#6b7280' }}>{group.description || '暂无描述'}</p>
          </div>
          <span style={{ padding: '6px 16px', borderRadius: '16px', fontSize: '14px', color: 'white', background: statusColors[group.status] }}>
            {statusLabels[group.status]}
          </span>
        </div>
      </div>

      {nextStatuses.length > 0 && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>状态操作</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="操作原因（可选）"
              value={statusReason}
              onChange={e => setStatusReason(e.target.value)}
              style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
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
                  background: status === 'approved' ? '#10b981' : status === 'rejected' ? '#ef4444' : '#3b82f6'
                }}
              >
                {status === 'approved' ? '通过审批' : status === 'rejected' ? '驳回' : status === 'draft' ? '退回草稿' : '提交审批'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        {(['info', 'versions', 'history', 'tests'] as const).map(tab => (
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
            {tab === 'info' ? '基本信息' : tab === 'versions' ? '版本历史' : tab === 'history' ? '状态变更' : '测试查询'}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {activeTab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>同义词列表</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {group.synonyms.map((s, i) => (
                  <span key={i} style={{ padding: '6px 16px', background: '#f3f4f6', borderRadius: '6px' }}>{s}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>应用范围</h4>
              <p>{group.application_scope}</p>
            </div>
            <div>
              <h4 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>当前版本</h4>
              <p>v{group.version}</p>
            </div>
            <div>
              <h4 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>创建人</h4>
              <p>{group.created_by}</p>
            </div>
            <div>
              <h4 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>创建时间</h4>
              <p>{formatDate(group.created_at)}</p>
            </div>
            <div>
              <h4 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>更新时间</h4>
              <p>{formatDate(group.updated_at)}</p>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div>
            {versions.length >= 2 && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '6px' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>版本对比</h4>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select
                    value={compareVersions?.v1 || ''}
                    onChange={e => setCompareVersions({ v1: Number(e.target.value), v2: compareVersions?.v2 || group.version })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  >
                    <option value="">选择版本</option>
                    {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
                  </select>
                  <span>与</span>
                  <select
                    value={compareVersions?.v2 || group.version}
                    onChange={e => setCompareVersions({ v1: compareVersions?.v1 || group.version, v2: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  >
                    {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
                  </select>
                </div>
              </div>
            )}

            {compareVersions && (
              <div style={{ marginBottom: '24px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <h4 style={{ marginBottom: '16px' }}>v{compareVersions.v1} vs v{compareVersions.v2} 对比</h4>
                {(() => {
                  const v1 = versions.find(v => v.version === compareVersions.v1);
                  const v2 = versions.find(v => v.version === compareVersions.v2);
                  if (!v1 || !v2) return null;
                  const added = v2.synonyms.filter(s => !v1.synonyms.includes(s));
                  const removed = v1.synonyms.filter(s => !v2.synonyms.includes(s));
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <p style={{ color: '#10b981', fontWeight: 500, marginBottom: '8px' }}>新增同义词</p>
                        {added.length > 0 ? added.map((s, i) => (
                          <span key={i} style={{ display: 'inline-block', padding: '4px 12px', background: '#dcfce7', borderRadius: '4px', margin: '4px' }}>+ {s}</span>
                        )) : <span style={{ color: '#9ca3af' }}>无</span>}
                      </div>
                      <div>
                        <p style={{ color: '#ef4444', fontWeight: 500, marginBottom: '8px' }}>移除同义词</p>
                        {removed.length > 0 ? removed.map((s, i) => (
                          <span key={i} style={{ display: 'inline-block', padding: '4px 12px', background: '#fee2e2', borderRadius: '4px', margin: '4px' }}>- {s}</span>
                        )) : <span style={{ color: '#9ca3af' }}>无</span>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div>
              {versions.map(v => (
                <div key={v.id} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600 }}>v{v.version}</span>
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>{formatDate(v.created_at)}</span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>创建人: {v.created_by}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {v.synonyms.map((s, i) => (
                      <span key={i} style={{ padding: '2px 8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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

        {activeTab === 'tests' && (
          <div>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="输入测试查询词"
                value={newTestQuery}
                onChange={e => setNewTestQuery(e.target.value)}
                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
              <button onClick={addTestQuery} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                添加测试
              </button>
            </div>
            <div>
              {testQueries.map(q => (
                <div key={q.id} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{q.query}</span>
                  <div style={{ fontSize: '14px' }}>
                    {q.actual_hits_before !== undefined && (
                      <span style={{ color: '#6b7280' }}>
                        原始命中: <span style={{ fontWeight: 600 }}>{q.actual_hits_before}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {testQueries.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>暂无测试查询</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
