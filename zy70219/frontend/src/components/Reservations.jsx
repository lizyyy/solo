import React, { useState, useEffect } from 'react';

function Reservations({ onViewReservation }) {
  const [reservations, setReservations] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filter, setFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    kitchen_id: '',
    team_id: '',
    start_time: '',
    end_time: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRes, kitchenRes, teamRes] = await Promise.all([
        fetch('/api/reservations'),
        fetch('/api/kitchens'),
        fetch('/api/reservations/teams')
      ]);
      
      setReservations(await resRes.json());
      setKitchens(await kitchenRes.json());
      setTeams(await teamRes.json());
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredReservations = filter 
    ? reservations.filter(r => r.status === filter)
    : reservations;

  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建失败');
      }
      
      setSuccess('预约创建成功！请选择设备后提交审批。');
      setShowCreateModal(false);
      setFormData({ kitchen_id: '', team_id: '', start_time: '', end_time: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: '草稿',
      submitted: '待审批',
      approved: '已批准',
      rejected: '已驳回',
      cancelled: '已取消',
      in_progress: '进行中',
      completed: '已完成'
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>预约列表</h2>
          <div className="flex-gap">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
            >
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="submitted">待审批</option>
              <option value="approved">已批准</option>
              <option value="rejected">已驳回</option>
            </select>
            <button 
              className="button button-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + 新建预约
            </button>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          {filteredReservations.length === 0 ? (
            <div className="empty-state">
              <h3>暂无预约记录</h3>
              <p>点击「新建预约」开始创建第一个预约</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>餐饮团队</th>
                  <th>共享厨房</th>
                  <th>预约时间</th>
                  <th>设备数</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map(r => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>{r.team_name}</td>
                    <td>{r.kitchen_name}</td>
                    <td>
                      {formatTime(r.start_time)}
                      <br />
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        至 {formatTime(r.end_time)}
                      </span>
                    </td>
                    <td>{r.equipment_count || 0}</td>
                    <td>
                      <span className={`badge badge-${r.status}`}>
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button button-secondary button-sm"
                        onClick={() => onViewReservation(r.id)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建预约</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <form className="modal-body" onSubmit={handleCreate}>
              <div className="form">
                <div className="form-group">
                  <label>共享厨房 *</label>
                  <select
                    value={formData.kitchen_id}
                    onChange={(e) => setFormData({ ...formData, kitchen_id: e.target.value })}
                    required
                  >
                    <option value="">请选择厨房</option>
                    {kitchens.map(k => (
                      <option key={k.id} value={k.id}>{k.name} (容量: {k.capacity})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>餐饮团队 *</label>
                  <select
                    value={formData.team_id}
                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                    required
                  >
                    <option value="">请选择团队</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>开始时间 *</label>
                    <input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>结束时间 *</label>
                    <input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="button button-primary">
                  创建预约
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reservations;
