import React, { useState, useEffect } from 'react';
import { systemsApi } from '../api';
import { useAppStore } from '../store';

export default function Systems() {
  const { showNotification } = useAppStore();
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    config: ''
  });

  useEffect(() => {
    loadSystems();
  }, []);

  async function loadSystems() {
    try {
      setLoading(true);
      const res = await systemsApi.getSystems();
      setSystems(res.data.data?.data || []);
    } catch (error) {
      console.error('加载系统失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await systemsApi.createSystem(formData);
      showNotification('success', '创建成功');
      setShowModal(false);
      setFormData({ name: '', code: '', config: '' });
      loadSystems();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '创建失败');
    }
  }

  async function handleToggleStatus(system: any) {
    const newStatus = system.status === 'active' ? 'inactive' : 'active';
    try {
      await systemsApi.updateStatus(system.id, newStatus);
      showNotification('success', '状态更新成功');
      loadSystems();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '更新失败');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🔧 外部系统管理</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 添加系统
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>系统名称</th>
                <th>系统编码</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => (
                <tr key={system.id}>
                  <td>{system.name}</td>
                  <td><code style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px' }}>{system.code}</code></td>
                  <td>
                    <span className={`badge badge-${system.status === 'active' ? 'available' : 'full'}`}>
                      {system.status === 'active' ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>{new Date(system.created_at).toLocaleString()}</td>
                  <td>{new Date(system.updated_at).toLocaleString()}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${system.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => handleToggleStatus(system)}
                    >
                      {system.status === 'active' ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
              {systems.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    暂无外部系统，请先添加
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>➕ 添加外部系统</h3>
            <div className="form-group">
              <label>系统名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：HIS系统A"
              />
            </div>
            <div className="form-group">
              <label>系统编码</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="例如：HIS_A"
              />
            </div>
            <div className="form-group">
              <label>配置信息 (JSON)</label>
              <textarea
                value={formData.config}
                onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                placeholder='{"endpoint": "http://example.com"}'
                rows={4}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
