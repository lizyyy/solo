import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Nanny } from '../types';

export default function Nannies() {
  const [nannies, setNannies] = useState<Nanny[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNanny, setNewNanny] = useState({
    name: '',
    phone: '',
    idCard: '',
    level: '中级月嫂',
    dailyRate: 500,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.nannies.getAll();
      setNannies(res.data);
    } catch (error) {
      console.error('加载月嫂数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNanny(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.nannies.create(newNanny);
      setShowCreateModal(false);
      setNewNanny({ name: '', phone: '', idCard: '', level: '中级月嫂', dailyRate: 500 });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建月嫂档案失败');
    }
  }

  const statusLabels: Record<string, string> = {
    available: '可用',
    on_service: '服务中',
    on_leave: '请假中',
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>月嫂档案</h1>
        <p>管理所有月嫂的基本信息</p>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + 添加月嫂
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>姓名</th>
              <th>电话</th>
              <th>身份证号</th>
              <th>级别</th>
              <th>日薪资</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {nannies.map(nanny => (
              <tr key={nanny.id}>
                <td>{nanny.name}</td>
                <td>{nanny.phone}</td>
                <td>{nanny.idCard}</td>
                <td>{nanny.level}</td>
                <td>¥{nanny.dailyRate}/天</td>
                <td>
                  <span className={`badge badge-${nanny.status === 'available' ? 'approved' : 'in-service'}`}>
                    {statusLabels[nanny.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加月嫂</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateNanny}>
              <div className="modal-body">
                <div className="form-group">
                  <label>姓名</label>
                  <input
                    type="text"
                    value={newNanny.name}
                    onChange={e => setNewNanny({ ...newNanny, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>电话</label>
                    <input
                      type="text"
                      value={newNanny.phone}
                      onChange={e => setNewNanny({ ...newNanny, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>身份证号</label>
                    <input
                      type="text"
                      value={newNanny.idCard}
                      onChange={e => setNewNanny({ ...newNanny, idCard: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>级别</label>
                    <select
                      value={newNanny.level}
                      onChange={e => setNewNanny({ ...newNanny, level: e.target.value })}
                      required
                    >
                      <option value="初级月嫂">初级月嫂</option>
                      <option value="中级月嫂">中级月嫂</option>
                      <option value="高级月嫂">高级月嫂</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>日薪资(元)</label>
                    <input
                      type="number"
                      value={newNanny.dailyRate}
                      onChange={e => setNewNanny({ ...newNanny, dailyRate: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
