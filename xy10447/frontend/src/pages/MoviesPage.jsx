import React, { useState, useEffect } from 'react';

export default function MoviesPage() {
  const [movies, setMovies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', duration: '', genre: '', description: '' });

  const loadMovies = async () => {
    const res = await fetch('/api/movies');
    const data = await res.json();
    setMovies(data);
  };

  useEffect(() => {
    loadMovies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setShowModal(false);
    setForm({ name: '', duration: '', genre: '', description: '' });
    loadMovies();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title">影片管理</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 添加影片
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>影片名称</th>
                <th>类型</th>
                <th>时长(分钟)</th>
                <th>描述</th>
              </tr>
            </thead>
            <tbody>
              {movies.map(movie => (
                <tr key={movie.id}>
                  <td>{movie.name}</td>
                  <td>{movie.genre || '-'}</td>
                  <td>{movie.duration}</td>
                  <td>{movie.description || '-'}</td>
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
              <h3>添加影片</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>影片名称 *</label>
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
                  <input
                    type="text"
                    value={form.genre}
                    onChange={e => setForm({ ...form, genre: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>时长(分钟) *</label>
                  <input
                    type="number"
                    required
                    value={form.duration}
                    onChange={e => setForm({ ...form, duration: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
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
