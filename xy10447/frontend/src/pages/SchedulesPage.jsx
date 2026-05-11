import React, { useState, useEffect } from 'react';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    movie_id: '',
    hall_id: '',
    start_time: '',
    end_time: '',
    base_price: '',
    vip_surcharge: ''
  });

  const loadData = async () => {
    const [schedulesRes, moviesRes, hallsRes] = await Promise.all([
      fetch('/api/schedules'),
      fetch('/api/movies'),
      fetch('/api/halls')
    ]);
    setSchedules(await schedulesRes.json());
    setMovies(await moviesRes.json());
    setHalls(await hallsRes.json());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const startDate = new Date(form.start_time);
    const endDate = new Date(form.end_time);
    
    await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movie_id: form.movie_id,
        hall_id: form.hall_id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        base_price: parseFloat(form.base_price),
        vip_surcharge: parseFloat(form.vip_surcharge) || 0
      })
    });
    setShowModal(false);
    setForm({ movie_id: '', hall_id: '', start_time: '', end_time: '', base_price: '', vip_surcharge: '' });
    loadData();
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { 
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title">排片管理</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 添加排片
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>影片</th>
                <th>影厅</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>基础票价</th>
                <th>VIP加价</th>
                <th>已售票数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td>{schedule.movie_name}</td>
                  <td>{schedule.hall_name}</td>
                  <td>{formatDateTime(schedule.start_time)}</td>
                  <td>{formatDateTime(schedule.end_time)}</td>
                  <td>¥{schedule.base_price}</td>
                  <td>¥{schedule.vip_surcharge || 0}</td>
                  <td>{schedule.sold_count}</td>
                  <td>
                    <span className={`badge ${schedule.status === 'active' ? 'badge-success' : 'badge-processing'}`}>
                      {schedule.status === 'active' ? '在售' : schedule.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加排片</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>影片 *</label>
                <select
                  required
                  value={form.movie_id}
                  onChange={e => setForm({ ...form, movie_id: e.target.value })}
                >
                  <option value="">请选择影片</option>
                  {movies.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.duration}分钟)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>影厅 *</label>
                <select
                  required
                  value={form.hall_id}
                  onChange={e => setForm({ ...form, hall_id: e.target.value })}
                >
                  <option value="">请选择影厅</option>
                  {halls.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.rows}排{h.cols}座)</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>开始时间 *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>结束时间 *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>基础票价 *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.base_price}
                    onChange={e => setForm({ ...form, base_price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>VIP加价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.vip_surcharge}
                    onChange={e => setForm({ ...form, vip_surcharge: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
