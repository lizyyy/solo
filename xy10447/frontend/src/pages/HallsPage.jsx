import React, { useState, useEffect } from 'react';

export default function HallsPage() {
  const [halls, setHalls] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedHall, setSelectedHall] = useState(null);
  const [seats, setSeats] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'normal', rows: '', cols: '' });

  const loadHalls = async () => {
    const res = await fetch('/api/halls');
    const data = await res.json();
    setHalls(data);
  };

  useEffect(() => {
    loadHalls();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/halls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        rows: parseInt(form.rows),
        cols: parseInt(form.cols)
      })
    });
    setShowModal(false);
    setForm({ name: '', type: 'normal', rows: '', cols: '' });
    loadHalls();
  };

  const showSeats = async (hall) => {
    setSelectedHall(hall);
    const res = await fetch(`/api/halls/${hall.id}/seats`);
    const data = await res.json();
    setSeats(data);
  };

  const typeLabels = {
    small: '小厅',
    medium: '中厅',
    large: '大厅',
    vip: 'VIP厅',
    normal: '普通厅'
  };

  const renderSeatGrid = () => {
    if (seats.length === 0) return null;
    const maxRow = Math.max(...seats.map(s => s.row_no));
    const maxCol = Math.max(...seats.map(s => s.col_no));
    const rows = [];
    for (let r = 1; r <= maxRow; r++) {
      const cols = [];
      for (let c = 1; c <= maxCol; c++) {
        const seat = seats.find(s => s.row_no === r && s.col_no === c);
        let className = 'seat ';
        if (seat?.is_disabled) {
          className += 'seat-disabled';
        } else if (seat?.is_vip) {
          className += 'seat-vip';
        } else {
          className += 'seat-available';
        }
        cols.push(
          <div key={c} className={className} title={seat?.seat_code}>
            {seat?.col_no}
          </div>
        );
      }
      rows.push(
        <div key={r} className="seat-row">
          <div style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#718096' }}>
            {String.fromCharCode(64 + r)}
          </div>
          {cols}
        </div>
      );
    }
    return (
      <div className="seat-grid">
        <div className="screen">银 幕</div>
        {rows}
        <div className="seat-legend">
          <div className="seat-legend-item">
            <div className="seat seat-available" style={{ width: '20px', height: '20px' }}></div>
            <span>普通座</span>
          </div>
          <div className="seat-legend-item">
            <div className="seat seat-vip" style={{ width: '20px', height: '20px' }}></div>
            <span>VIP座</span>
          </div>
          <div className="seat-legend-item">
            <div className="seat seat-disabled" style={{ width: '20px', height: '20px' }}></div>
            <span>禁用</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title">影厅管理</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 添加影厅
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>影厅名称</th>
                <th>类型</th>
                <th>排数</th>
                <th>每排座数</th>
                <th>座位数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {halls.map(hall => (
                <tr key={hall.id}>
                  <td>{hall.name}</td>
                  <td>
                    <span className="badge badge-processing">{typeLabels[hall.type] || hall.type}</span>
                  </td>
                  <td>{hall.rows}</td>
                  <td>{hall.cols}</td>
                  <td>{hall.seat_count}</td>
                  <td>
                    <button className="btn btn-secondary btn-small" onClick={() => showSeats(hall)}>
                      查看座位
                    </button>
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
              <h3>添加影厅</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>影厅名称 *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>类型</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="small">小厅</option>
                    <option value="medium">中厅</option>
                    <option value="large">大厅</option>
                    <option value="vip">VIP厅</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>排数 *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={form.rows}
                    onChange={e => setForm({ ...form, rows: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>每排座数 *</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={form.cols}
                    onChange={e => setForm({ ...form, cols: e.target.value })}
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

      {selectedHall && (
        <div className="modal-overlay" onClick={() => { setSelectedHall(null); setSeats([]); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedHall.name} - 座位图</h3>
              <button className="modal-close" onClick={() => { setSelectedHall(null); setSeats([]); }}>&times;</button>
            </div>
            {renderSeatGrid()}
          </div>
        </div>
      )}
    </div>
  );
}
