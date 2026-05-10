import React, { useState, useEffect } from 'react';

function Schedules() {
  const [kitchens, setKitchens] = useState([]);
  const [cleanings, setCleanings] = useState([]);
  const [fireInspections, setFireInspections] = useState([]);
  const [showCleaningModal, setShowCleaningModal] = useState(false);
  const [showFireModal, setShowFireModal] = useState(false);
  const [cleaningForm, setCleaningForm] = useState({
    kitchen_id: '',
    start_time: '',
    end_time: '',
    operator: ''
  });
  const [fireForm, setFireForm] = useState({
    kitchen_id: '',
    scheduled_time: '',
    inspector: ''
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
      const [kitchenRes, cleaningRes, fireRes] = await Promise.all([
        fetch('/api/kitchens'),
        fetch('/api/schedules/cleaning'),
        fetch('/api/schedules/fire-inspections')
      ]);
      
      setKitchens(await kitchenRes.json());
      setCleanings(await cleaningRes.json());
      setFireInspections(await fireRes.json());
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status) => {
    const labels = {
      scheduled: '已安排',
      in_progress: '进行中',
      completed: '已完成',
      passed: '已通过',
      failed: '未通过',
      missed: '已错过'
    };
    return labels[status] || status;
  };

  const handleAddCleaning = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/schedules/cleaning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaningForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加失败');
      }
      
      setSuccess('清洁窗口添加成功！');
      setShowCleaningModal(false);
      setCleaningForm({ kitchen_id: '', start_time: '', end_time: '', operator: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddFireInspection = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/schedules/fire-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fireForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加失败');
      }
      
      setSuccess('消防检查添加成功！');
      setShowFireModal(false);
      setFireForm({ kitchen_id: '', scheduled_time: '', inspector: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateCleaningStatus = async (id, status) => {
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`/api/schedules/cleaning/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }
      
      setSuccess('状态已更新');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateFireStatus = async (id, status, result = '') => {
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`/api/schedules/fire-inspections/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, result })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }
      
      setSuccess('状态已更新');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="card">
        <div className="card-header">
          <h2>清洁窗口安排</h2>
          <button 
            className="button button-primary"
            onClick={() => setShowCleaningModal(true)}
          >
            + 安排清洁
          </button>
        </div>
        <div className="card-body">
          {cleanings.length === 0 ? (
            <div className="empty-state">
              <h3>暂无清洁安排</h3>
              <p>点击「安排清洁」设置清洁时间窗口</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#64748b' }}>
                提示：清洁期间厨房不可预约
              </p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>厨房</th>
                  <th>开始时间</th>
                  <th>结束时间</th>
                  <th>操作人员</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {cleanings.map(c => (
                  <tr key={c.id}>
                    <td>{c.kitchen_name}</td>
                    <td>{formatTime(c.start_time)}</td>
                    <td>{formatTime(c.end_time)}</td>
                    <td>{c.operator || '-'}</td>
                    <td>
                      <span className={`badge badge-${c.status === 'completed' ? 'approved' : c.status === 'in_progress' ? 'submitted' : 'scheduled'}`}>
                        {getStatusLabel(c.status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex-gap">
                        {c.status === 'scheduled' && (
                          <button
                            className="button button-primary button-sm"
                            onClick={() => updateCleaningStatus(c.id, 'in_progress')}
                          >
                            开始
                          </button>
                        )}
                        {c.status === 'in_progress' && (
                          <button
                            className="button button-success button-sm"
                            onClick={() => updateCleaningStatus(c.id, 'completed')}
                          >
                            完成
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>消防检查安排</h2>
          <button 
            className="button button-primary"
            onClick={() => setShowFireModal(true)}
          >
            + 安排检查
          </button>
        </div>
        <div className="card-body">
          {fireInspections.length === 0 ? (
            <div className="empty-state">
              <h3>暂无消防检查安排</h3>
              <p>点击「安排检查」设置消防检查时间</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#64748b' }}>
                提示：消防检查期间（含前后2小时）厨房暂停使用
              </p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>厨房</th>
                  <th>检查时间</th>
                  <th>检查员</th>
                  <th>状态</th>
                  <th>结果</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {fireInspections.map(f => (
                  <tr key={f.id}>
                    <td>{f.kitchen_name}</td>
                    <td>{formatTime(f.scheduled_time)}</td>
                    <td>{f.inspector || '-'}</td>
                    <td>
                      <span className={`badge badge-${f.status === 'passed' ? 'approved' : f.status === 'failed' ? 'rejected' : f.status === 'in_progress' ? 'submitted' : 'scheduled'}`}>
                        {getStatusLabel(f.status)}
                      </span>
                    </td>
                    <td>{f.result || '-'}</td>
                    <td>
                      <div className="flex-gap">
                        {f.status === 'scheduled' && (
                          <button
                            className="button button-primary button-sm"
                            onClick={() => updateFireStatus(f.id, 'in_progress')}
                          >
                            开始
                          </button>
                        )}
                        {f.status === 'in_progress' && (
                          <>
                            <button
                              className="button button-success button-sm"
                              onClick={() => updateFireStatus(f.id, 'passed', '检查通过')}
                            >
                              通过
                            </button>
                            <button
                              className="button button-danger button-sm"
                              onClick={() => updateFireStatus(f.id, 'failed', '检查未通过')}
                            >
                              未通过
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>档期冲突规则说明</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
              <h4 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>设备占用冲突</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                同一设备在同一时间段被多个预约占用时触发。需要调整时间或选择其他设备。
              </p>
            </div>
            <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>清洁窗口冲突</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                预约时间与清洁窗口重叠时触发。清洁期间厨房不可用，需避开。
              </p>
            </div>
            <div style={{ padding: '1rem', background: '#dbeafe', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
              <h4 style={{ color: '#1e40af', marginBottom: '0.5rem' }}>消防检查冲突</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                预约时间与消防检查时间（含前后2小时缓冲）重叠时触发。
              </p>
            </div>
            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
              <h4 style={{ color: '#065f46', marginBottom: '0.5rem' }}>厨房容量限制</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                同一时间超过厨房容量的预约数量时触发。考虑调整时间或使用其他厨房。
              </p>
            </div>
          </div>
        </div>
      </div>

      {showCleaningModal && (
        <div className="modal-backdrop" onClick={() => setShowCleaningModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>安排清洁窗口</h3>
              <button className="modal-close" onClick={() => setShowCleaningModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleAddCleaning}>
              <div className="form">
                <div className="form-group">
                  <label>选择厨房 *</label>
                  <select
                    value={cleaningForm.kitchen_id}
                    onChange={(e) => setCleaningForm({ ...cleaningForm, kitchen_id: e.target.value })}
                    required
                  >
                    <option value="">请选择</option>
                    {kitchens.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>开始时间 *</label>
                    <input
                      type="datetime-local"
                      value={cleaningForm.start_time}
                      onChange={(e) => setCleaningForm({ ...cleaningForm, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>结束时间 *</label>
                    <input
                      type="datetime-local"
                      value={cleaningForm.end_time}
                      onChange={(e) => setCleaningForm({ ...cleaningForm, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>操作人员</label>
                  <input
                    type="text"
                    value={cleaningForm.operator}
                    onChange={(e) => setCleaningForm({ ...cleaningForm, operator: e.target.value })}
                    placeholder="清洁人员姓名"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="button button-secondary" onClick={() => setShowCleaningModal(false)}>
                  取消
                </button>
                <button type="submit" className="button button-primary">
                  确认安排
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFireModal && (
        <div className="modal-backdrop" onClick={() => setShowFireModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>安排消防检查</h3>
              <button className="modal-close" onClick={() => setShowFireModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleAddFireInspection}>
              <div className="form">
                <div className="form-group">
                  <label>选择厨房 *</label>
                  <select
                    value={fireForm.kitchen_id}
                    onChange={(e) => setFireForm({ ...fireForm, kitchen_id: e.target.value })}
                    required
                  >
                    <option value="">请选择</option>
                    {kitchens.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>检查时间 *</label>
                  <input
                    type="datetime-local"
                    value={fireForm.scheduled_time}
                    onChange={(e) => setFireForm({ ...fireForm, scheduled_time: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>检查员</label>
                  <input
                    type="text"
                    value={fireForm.inspector}
                    onChange={(e) => setFireForm({ ...fireForm, inspector: e.target.value })}
                    placeholder="检查员姓名"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="button button-secondary" onClick={() => setShowFireModal(false)}>
                  取消
                </button>
                <button type="submit" className="button button-primary">
                  确认安排
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Schedules;
