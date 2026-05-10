import React, { useState, useEffect } from 'react';

function ReservationDetail({ id, onBack }) {
  const [reservation, setReservation] = useState(null);
  const [equipments, setEquipments] = useState([]);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({
    equipment_id: '',
    start_time: '',
    end_time: ''
  });
  const [approveComments, setApproveComments] = useState('');
  const [rejectComments, setRejectComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [resRes, equipRes] = await Promise.all([
        fetch(`/api/reservations/${id}`),
        fetch(`/api/kitchens/${reservation?.kitchen_id || (await fetch(`/api/reservations/${id}`).then(r => r.json())).kitchen_id}/equipments`)
      ]);
      
      const resData = await resRes.json();
      setReservation(resData);
      
      const kitchenId = resData.kitchen_id;
      const equipmentsRes = await fetch(`/api/kitchens/${kitchenId}/equipments`);
      setEquipments(await equipmentsRes.json());
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
      draft: '草稿',
      submitted: '待审批',
      approved: '已批准',
      rejected: '已驳回',
      cancelled: '已取消',
      in_progress: '进行中',
      completed: '已完成',
      pending: '待确认',
      confirmed: '已确认'
    };
    return labels[status] || status;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSubmitResult(null);
    
    try {
      const res = await fetch(`/api/reservations/${id}/submit`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '提交失败');
      }
      
      setSubmitResult(data);
      
      if (data.conflicts && data.conflicts.length > 0) {
        setError(`提交成功但存在 ${data.conflicts.length} 个冲突，请查看下方处理建议`);
      } else {
        setSuccess('提交成功！等待审批中。');
      }
      
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApprove = async () => {
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`/api/reservations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: approveComments })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '审批失败');
      }
      
      setSuccess('审批通过！设备占用已锁定。');
      setApproveComments('');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async () => {
    setError('');
    setSuccess('');
    
    if (!rejectComments.trim()) {
      setError('驳回时请填写原因');
      return;
    }
    
    try {
      const res = await fetch(`/api/reservations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: rejectComments })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '驳回失败');
      }
      
      setSuccess('已驳回预约。');
      setRejectComments('');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`/api/reservations/${id}/equipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipmentForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加设备失败');
      }
      
      setSuccess('设备添加成功！');
      setShowAddEquipment(false);
      setEquipmentForm({ equipment_id: '', start_time: '', end_time: '' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveEquipment = async (bookingId) => {
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`/api/reservations/${id}/equipments/${bookingId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '移除设备失败');
      }
      
      setSuccess('设备已移除');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!reservation) {
    return <div className="error-message">预约记录不存在</div>;
  }

  const canSubmit = reservation.status === 'draft' && reservation.equipment_bookings?.length > 0;
  const canApprove = reservation.status === 'submitted';
  const canReject = reservation.status === 'submitted';
  const canEditEquipment = reservation.status === 'draft';

  return (
    <div>
      <button className="button button-secondary mb-2" onClick={onBack}>
        ← 返回列表
      </button>

      <div className="card">
        <div className="card-header">
          <h2>预约 #{reservation.id}</h2>
          <span className={`badge badge-${reservation.status}`}>
            {getStatusLabel(reservation.status)}
          </span>
        </div>
        <div className="card-body">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <div className="reservation-detail">
            <div>
              <div className="section-title">基本信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>餐饮团队</div>
                  <div style={{ fontWeight: 500 }}>{reservation.team_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>共享厨房</div>
                  <div style={{ fontWeight: 500 }}>{reservation.kitchen_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>开始时间</div>
                  <div>{formatTime(reservation.start_time)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>结束时间</div>
                  <div>{formatTime(reservation.end_time)}</div>
                </div>
              </div>

              <div className="section-title" style={{ marginTop: '2rem' }}>
                设备占用 ({reservation.equipment_bookings?.length || 0})
              </div>
              
              {!canEditEquipment && reservation.equipment_bookings?.length === 0 && (
                <div className="error-message">
                  来源记录缺失：请先选择要使用的设备
                </div>
              )}
              
              {reservation.equipment_bookings?.length === 0 ? (
                <p style={{ color: '#64748b' }}>尚未选择设备</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>设备</th>
                      <th>类型</th>
                      <th>使用时间</th>
                      <th>状态</th>
                      {canEditEquipment && <th>操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reservation.equipment_bookings.map(eb => (
                      <tr key={eb.id}>
                        <td>{eb.equipment_name}</td>
                        <td>{eb.equipment_type || '-'}</td>
                        <td>
                          {formatTime(eb.start_time)}
                          <br />
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            至 {formatTime(eb.end_time)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${eb.status === 'confirmed' ? 'approved' : 'draft'}`}>
                            {getStatusLabel(eb.status)}
                          </span>
                        </td>
                        {canEditEquipment && (
                          <td>
                            <button
                              className="button button-danger button-sm"
                              onClick={() => handleRemoveEquipment(eb.id)}
                            >
                              移除
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              {canEditEquipment && (
                <div className="mt-2">
                  {!showAddEquipment ? (
                    <button 
                      className="button button-primary button-sm"
                      onClick={() => setShowAddEquipment(true)}
                    >
                      + 添加设备
                    </button>
                  ) : (
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                      <h4 style={{ marginBottom: '1rem' }}>添加设备</h4>
                      <form onSubmit={handleAddEquipment} className="form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>选择设备</label>
                            <select
                              value={equipmentForm.equipment_id}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_id: e.target.value })}
                              required
                            >
                              <option value="">请选择</option>
                              {equipments.map(e => (
                                <option key={e.id} value={e.id}>
                                  {e.name} {e.type ? `(${e.type})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>使用开始时间</label>
                            <input
                              type="datetime-local"
                              value={equipmentForm.start_time}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, start_time: e.target.value })}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>使用结束时间</label>
                            <input
                              type="datetime-local"
                              value={equipmentForm.end_time}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, end_time: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="flex-gap">
                          <button type="submit" className="button button-primary">
                            确认添加
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => setShowAddEquipment(false)}
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="section-title">当前卡点</div>
              {reservation.block_points && reservation.block_points.length > 0 ? (
                reservation.block_points.map((bp, idx) => (
                  <div key={idx} className={`block-point ${bp.priority}`}>
                    <h4>{bp.title}</h4>
                    <p>{bp.description}</p>
                  </div>
                ))
              ) : (
                <p style={{ color: '#64748b' }}>暂无卡点</p>
              )}

              {submitResult && submitResult.suggestions && submitResult.suggestions.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: '2rem' }}>处理建议</div>
                  <ul className="suggestion-list">
                    {submitResult.suggestions.map((s, idx) => (
                      <li key={idx}>{s.text}</li>
                    ))}
                  </ul>
                </>
              )}

              <div className="section-title" style={{ marginTop: '2rem' }}>操作区</div>
              <div className="flex-gap" style={{ flexWrap: 'wrap' }}>
                <button
                  className="button button-primary"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  title={!canSubmit ? reservation.status === 'submitted' ? '重复提交：预约已在审批流程中' : '请先添加设备' : ''}
                >
                  提交审批
                </button>
                
                {canApprove && (
                  <>
                    <textarea
                      placeholder="审批备注（可选）"
                      value={approveComments}
                      onChange={(e) => setApproveComments(e.target.value)}
                      style={{ width: '100%', height: '60px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}
                    />
                    <button
                      className="button button-success"
                      onClick={handleApprove}
                    >
                      ✓ 批准
                    </button>
                  </>
                )}
                
                {canReject && (
                  <>
                    <textarea
                      placeholder="驳回原因（必填）"
                      value={rejectComments}
                      onChange={(e) => setRejectComments(e.target.value)}
                      style={{ width: '100%', height: '60px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}
                    />
                    <button
                      className="button button-danger"
                      onClick={handleReject}
                    >
                      ✗ 驳回
                    </button>
                  </>
                )}
              </div>

              <div className="section-title" style={{ marginTop: '2rem' }}>历史变化</div>
              {reservation.history && reservation.history.length > 0 ? (
                <div className="timeline">
                  {reservation.history.map((h, idx) => (
                    <div key={idx} className="timeline-item">
                      <div className="time">{formatTime(h.created_at)}</div>
                      <div className="action">{h.action}</div>
                      {h.new_value && (
                        <div className="detail">
                          {h.new_value.status && `状态: ${getStatusLabel(h.new_value.status)}`}
                          {h.new_value.comments && ` · ${h.new_value.comments}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>暂无历史记录</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReservationDetail;
