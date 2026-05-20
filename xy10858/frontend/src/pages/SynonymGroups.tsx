import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { synonymGroupsApi, formatDate } from '../api';
import { statusColors, statusLabels, type SynonymGroup } from '../types';

export default function SynonymGroups() {
  const [groups, setGroups] = useState<SynonymGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', synonyms: '', application_scope: '', description: '' });

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const data = await synonymGroupsApi.list();
      setGroups(data);
    } catch (error) {
      alert('加载失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await synonymGroupsApi.create({
        ...formData,
        synonyms: formData.synonyms.split(',').map(s => s.trim()).filter(Boolean)
      });
      setShowCreate(false);
      setFormData({ name: '', synonyms: '', application_scope: '', description: '' });
      loadGroups();
    } catch (error) {
      alert('创建失败: ' + (error as Error).message);
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>同义词组管理</h2>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          + 新建同义词组
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>新建同义词组</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>同义词（英文逗号分隔）</label>
              <input
                type="text"
                value={formData.synonyms}
                onChange={e => setFormData({ ...formData, synonyms: e.target.value })}
                placeholder="例如: 手机,智能手机,移动电话"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>应用范围</label>
              <input
                type="text"
                value={formData.application_scope}
                onChange={e => setFormData({ ...formData, application_scope: e.target.value })}
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
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>名称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>同义词</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>应用范围</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>版本</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>更新时间</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <tr key={group.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{group.name}</td>
                <td style={{ padding: '12px 16px', maxWidth: '250px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {group.synonyms.slice(0, 3).map((s, i) => (
                      <span key={i} style={{ padding: '2px 8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>{s}</span>
                    ))}
                    {group.synonyms.length > 3 && <span style={{ fontSize: '12px', color: '#6b7280' }}>+{group.synonyms.length - 3}</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>{group.application_scope}</td>
                <td style={{ padding: '12px 16px' }}>v{group.version}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: 'white', background: statusColors[group.status] }}>
                    {statusLabels[group.status]}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{formatDate(group.updated_at)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <Link to={`/synonym-groups/${group.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>查看详情</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {groups.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>暂无数据</div>
        )}
      </div>
    </div>
  );
}
