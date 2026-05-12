import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    rateLimit: '',
    rateWindow: 'minute',
    priority: 1,
    description: '',
    isTrial: false,
    trialDays: 0,
    monthlyPrice: 0
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const data = await api.getPlans();
      setPlans(data);
      setLoading(false);
    } catch (err) {
      setError('加载套餐失败: ' + err.message);
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createPlan({
        ...form,
        rateLimit: parseInt(form.rateLimit),
        priority: parseInt(form.priority),
        trialDays: parseInt(form.trialDays),
        monthlyPrice: parseFloat(form.monthlyPrice)
      });
      setShowCreate(false);
      setForm({
        name: '',
        rateLimit: '',
        rateWindow: 'minute',
        priority: 1,
        description: '',
        isTrial: false,
        trialDays: 0,
        monthlyPrice: 0
      });
      loadPlans();
    } catch (err) {
      setError('创建套餐失败: ' + err.message);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>套餐管理</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + 新建套餐
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>套餐名称</th>
                <th>速率限制</th>
                <th>优先级</th>
                <th>月费</th>
                <th>状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td className="font-semibold">
                    {plan.name}
                    {plan.is_trial === 1 && (
                      <span className="badge badge-info ml-2">试用</span>
                    )}
                  </td>
                  <td>{plan.rate_limit} 次/{plan.rate_window}</td>
                  <td>{plan.priority}</td>
                  <td>¥{plan.monthly_price}/月</td>
                  <td>
                    <span className={`badge ${plan.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {plan.status}
                    </span>
                  </td>
                  <td className="muted">{plan.description}</td>
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
              <h3>新建套餐</h3>
              <button className="close-btn" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                <label>套餐名称 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label>速率限制 *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.rateLimit}
                      onChange={e => setForm({ ...form, rateLimit: e.target.value })}
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>时间窗口</label>
                    <select
                      className="form-select"
                      value={form.rateWindow}
                      onChange={e => setForm({ ...form, rateWindow: e.target.value })}
                    >
                      <option value="minute">分钟</option>
                      <option value="hour">小时</option>
                      <option value="day">天</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label>优先级</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value })}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label>月费 (¥)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.monthlyPrice}
                      onChange={e => setForm({ ...form, monthlyPrice: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isTrial}
                      onChange={e => setForm({ ...form, isTrial: e.target.checked })}
                    />
                    试用套餐
                  </label>
                </div>
                {form.isTrial && (
                  <div className="form-group">
                    <label>试用天数</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.trialDays}
                      onChange={e => setForm({ ...form, trialDays: e.target.value })}
                      min="1"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>说明</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
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

export default PlansPage;
