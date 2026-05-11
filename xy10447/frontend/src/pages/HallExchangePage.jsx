import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HallExchangePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    original_schedule_id: '',
    target_hall_id: '',
    reason: '影厅设备故障，需要紧急换厅'
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const [requestsRes, schedulesRes, hallsRes] = await Promise.all([
      fetch('/api/hall-exchange'),
      fetch('/api/schedules'),
      fetch('/api/halls')
    ]);
    setRequests(await requestsRes.json());
    setSchedules(await schedulesRes.json());
    setHalls(await hallsRes.json());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExchange = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/hall-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (res.ok) {
        setShowCreateModal(false);
        setForm({ original_schedule_id: '', target_hall_id: '', reason: '影厅设备故障，需要紧急换厅' });
        loadData();
        navigate(`/exchange/${data.requestId}`);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('创建换厅申请失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { 
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const statusLabels = {
    pending: { label: '待处理', class: 'badge-pending' },
    processing: { label: '处理中', class: 'badge-processing' },
    completed: { label: '已完成', class: 'badge-completed' },
    failed: { label: '失败', class: 'badge-danger' }
  };

  const availableSchedules = schedules.filter(s => {
    const startTime = new Date(s.start_time);
    return startTime > new Date() && s.status === 'active' && s.sold_count > 0;
  });

  const activeRequests = requests.filter(r => r.status !== 'completed');
  const completedRequests = requests.filter(r => r.status === 'completed');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title">🎬 换厅工作台</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowCreateModal(true)}
          disabled={availableSchedules.length === 0}
        >
          + 发起换厅申请
        </button>
      </div>

      {activeRequests.length > 0 && (
        <div className="section">
          <h3 className="section-title">⏳ 处理中的换厅申请 ({activeRequests.length})</h3>
          {activeRequests.map(request => {
            const status = statusLabels[request.status] || statusLabels.pending;
            return (
              <div key={request.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      {request.movie_name}
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', color: '#4a5568', fontSize: '0.875rem' }}>
                      <span>🕐 {formatDateTime(request.start_time)}</span>
                      <span>📍 {request.original_hall} → {request.target_hall}</span>
                      <span>👥 影响观众: {request.affected_count}人</span>
                    </div>
                    {request.reason && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
                        原因: {request.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className={`badge ${status.class}`}>{status.label}</span>
                    <button 
                      className="btn btn-primary btn-small"
                      onClick={() => navigate(`/exchange/${request.id}`)}
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section">
        <h3 className="section-title">📋 可换厅场次</h3>
        {availableSchedules.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>🎥</span>
            <p>当前没有可发起换厅的场次</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              （需要未开场、有售票记录的场次才能发起换厅）
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>影片</th>
                    <th>影厅</th>
                    <th>时间</th>
                    <th>已售票数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {availableSchedules.map(schedule => {
                    const hasExistingRequest = requests.some(
                      r => r.original_schedule_id === schedule.id && r.status !== 'completed'
                    );
                    return (
                      <tr key={schedule.id}>
                        <td>{schedule.movie_name}</td>
                        <td>{schedule.hall_name}</td>
                        <td>{formatDateTime(schedule.start_time)}</td>
                        <td>{schedule.sold_count}张</td>
                        <td>
                          {hasExistingRequest ? (
                            <span className="badge badge-pending">已有换厅申请</span>
                          ) : (
                            <button 
                              className="btn btn-warning btn-small"
                              onClick={() => {
                                setForm(prev => ({ ...prev, original_schedule_id: schedule.id }));
                                setShowCreateModal(true);
                              }}
                            >
                              发起换厅
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {completedRequests.length > 0 && (
        <div className="section">
          <h3 className="section-title">✅ 已完成的换厅申请 ({completedRequests.length})</h3>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>影片</th>
                    <th>原影厅 → 新影厅</th>
                    <th>时间</th>
                    <th>影响人数</th>
                    <th>申请时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {completedRequests.map(request => (
                    <tr key={request.id}>
                      <td>{request.movie_name}</td>
                      <td>{request.original_hall} → {request.target_hall}</td>
                      <td>{formatDateTime(request.start_time)}</td>
                      <td>{request.affected_count}人</td>
                      <td>{formatDateTime(request.created_at)}</td>
                      <td>
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => navigate(`/exchange/${request.id}`)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>发起换厅申请</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>

            {error && (
              <div className="alert alert-danger">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleCreateExchange}>
              <div className="form-group">
                <label>选择场次 *</label>
                <select
                  required
                  value={form.original_schedule_id}
                  onChange={e => setForm({ ...form, original_schedule_id: e.target.value })}
                >
                  <option value="">请选择需要换厅的场次</option>
                  {availableSchedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.movie_name} - {s.hall_name} - {formatDateTime(s.start_time)} ({s.sold_count}张票)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>目标影厅 *</label>
                <select
                  required
                  value={form.target_hall_id}
                  onChange={e => setForm({ ...form, target_hall_id: e.target.value })}
                >
                  <option value="">请选择目标影厅</option>
                  {halls.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.rows}排{h.cols}座，共{h.seat_count}座)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>换厅原因</label>
                <textarea
                  rows="3"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <div className="alert alert-warning">
                <strong>注意事项：</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                  <li>已开场的场次无法换厅</li>
                  <li>每个场次只能有一个进行中的换厅申请</li>
                  <li>目标影厅在该时间段必须空闲</li>
                </ul>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? '处理中...' : '发起换厅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
