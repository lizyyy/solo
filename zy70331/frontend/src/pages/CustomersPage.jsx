import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await api.getCustomers();
      setCustomers(data);
      setLoading(false);
    } catch (err) {
      setError('加载客户失败: ' + err.message);
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createCustomer(form);
      setShowCreate(false);
      setForm({ name: '', email: '' });
      loadCustomers();
    } catch (err) {
      setError('创建客户失败: ' + err.message);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>客户管理</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + 新建客户
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>客户名称</th>
                <th>邮箱</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id}>
                  <td className="font-semibold">{customer.name}</td>
                  <td>{customer.email || '-'}</td>
                  <td>
                    <span className={`badge ${customer.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {customer.status === 'active' ? '活跃' : customer.status}
                    </span>
                  </td>
                  <td className="text-sm muted">{new Date(customer.created_at).toLocaleString()}</td>
                  <td>
                    <Link to={`/customers/${customer.id}`} className="btn btn-primary btn-sm">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建客户</h3>
              <button className="close-btn" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>客户名称 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>邮箱</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
