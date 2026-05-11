import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function HallExchangeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [targetHallSeats, setTargetHallSeats] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hall-exchange/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
        
        if (data.request?.new_schedule_id) {
          const newScheduleRes = await fetch('/api/schedules');
          const schedules = await newScheduleRes.json();
          const newSchedule = schedules.find(s => s.id === data.request.new_schedule_id);
          if (newSchedule) {
            const seatsRes = await fetch(`/api/halls/${newSchedule.hall_id}/seats`);
            setTargetHallSeats(await seatsRes.json());
          }
        }
      }
    } catch (err) {
      console.error('Failed to load details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [id]);

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { 
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const handleConfirm = async (mappingId) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/hall-exchange/${id}/mappings/${mappingId}/confirm`, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage('座位已确认');
        setTimeout(() => setSuccessMessage(null), 2000);
        loadDetails();
      } else {
        const data = await res.json();
        setActionError(data.error);
      }
    } catch (err) {
      setActionError('操作失败');
    }
  };

  const handleAssign = async (mappingId) => {
    if (!selectedSeat) {
      setActionError('请先选择一个座位');
      return;
    }
    setActionError(null);
    try {
      const res = await fetch(`/api/hall-exchange/${id}/mappings/${mappingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_seat_id: selectedSeat })
      });
      if (res.ok) {
        setShowAssignModal(null);
        setSelectedSeat(null);
        setSuccessMessage('座位已分配');
        setTimeout(() => setSuccessMessage(null), 2000);
        loadDetails();
      } else {
        const data = await res.json();
        setActionError(data.error);
      }
    } catch (err) {
      setActionError('操作失败');
    }
  };

  const handleRefund = async (mappingId, reason) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/hall-exchange/${id}/mappings/${mappingId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        setSuccessMessage('已办理退票');
        setTimeout(() => setSuccessMessage(null), 2000);
        loadDetails();
      } else {
        const data = await res.json();
        setActionError(data.error);
      }
    } catch (err) {
      setActionError('操作失败');
    }
  };

  const handleConfirmAll = async () => {
    if (!details) return;
    const pendingMappings = details.mappings.filter(m => m.status === 'pending_confirm');
    for (const mapping of pendingMappings) {
      await handleConfirm(mapping.id);
    }
  };

  const handleComplete = async () => {
    if (!details?.canComplete) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/hall-exchange/${id}/complete`, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage('换厅已完成，已发送通知给所有观众');
        loadDetails();
      } else {
        const data = await res.json();
        setActionError(data.error);
      }
    } catch (err) {
      setActionError('操作失败');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending_confirm: { label: '待确认', class: 'badge-pending' },
      manual_required: { label: '需人工处理', class: 'badge-manual' },
      resolved: { label: '已换厅', class: 'badge-success' },
      refunded: { label: '已退票', class: 'badge-danger' }
    };
    return map[status] || { label: status, class: 'badge-pending' };
  };

  const getMappingTypeLabel = (type) => {
    const map = {
      exact: '完全匹配',
      same_row: '同排座位',
      nearby: '邻近座位',
      other: '其他座位',
      manual: '人工分配',
      manual_required: '无法自动匹配'
    };
    return map[type] || type;
  };

  const renderSeatGridForSelection = (currentMapping) => {
    if (targetHallSeats.length === 0) return null;
    
    const occupiedSeatIds = new Set(
      details.mappings
        .filter(m => m.id !== currentMapping?.id && m.new_seat_id && m.status !== 'refunded')
        .map(m => m.new_seat_id)
    );

    const maxRow = Math.max(...targetHallSeats.map(s => s.row_no));
    const maxCol = Math.max(...targetHallSeats.map(s => s.col_no));
    const rows = [];

    for (let r = 1; r <= maxRow; r++) {
      const cols = [];
      for (let c = 1; c <= maxCol; c++) {
        const seat = targetHallSeats.find(s => s.row_no === r && s.col_no === c);
        if (!seat) {
          cols.push(<div key={c} style={{ width: '28px' }}></div>);
          continue;
        }

        let className = 'seat ';
        const isOccupied = occupiedSeatIds.has(seat.id);
        const isDisabled = seat.is_disabled;
        const isSelected = selectedSeat === seat.id;

        if (isDisabled) {
          className += 'seat-disabled';
        } else if (isOccupied) {
          className += 'seat-sold';
        } else if (isSelected) {
          className += 'seat-selected';
        } else if (seat.is_vip) {
          className += 'seat-vip';
        } else {
          className += 'seat-available';
        }

        cols.push(
          <div 
            key={c} 
            className={className}
            onClick={() => !isDisabled && !isOccupied && setSelectedSeat(seat.id)}
            title={seat.seat_code}
          >
            {seat.col_no}
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
      <div>
        <div className="seat-grid">
          <div className="screen">银 幕</div>
          {rows}
        </div>
        <div className="seat-legend">
          <div className="seat-legend-item">
            <div className="seat seat-available" style={{ width: '20px', height: '20px' }}></div>
            <span>可选</span>
          </div>
          <div className="seat-legend-item">
            <div className="seat seat-selected" style={{ width: '20px', height: '20px' }}></div>
            <span>已选</span>
          </div>
          <div className="seat-legend-item">
            <div className="seat seat-sold" style={{ width: '20px', height: '20px' }}></div>
            <span>已分配</span>
          </div>
          <div className="seat-legend-item">
            <div className="seat seat-vip" style={{ width: '20px', height: '20px' }}></div>
            <span>VIP座</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!details) {
    return (
      <div className="empty-state">
        <span style={{ fontSize: '3rem' }}>😕</span>
        <p>换厅申请不存在</p>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>
          返回工作台
        </button>
      </div>
    );
  }

  const { request, mappings, stats, canComplete } = details;
  const isCompleted = request.status === 'completed';
  const manualMappings = mappings.filter(m => m.status === 'manual_required');
  const pendingMappings = mappings.filter(m => m.status === 'pending_confirm');
  const resolvedMappings = mappings.filter(m => m.status === 'resolved' || m.status === 'refunded');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <button className="btn btn-secondary btn-small" onClick={() => navigate('/')} style={{ marginBottom: '0.5rem' }}>
            ← 返回工作台
          </button>
          <h2 className="page-title" style={{ margin: 0 }}>
            {request.movie_name} - 换厅详情
          </h2>
        </div>
        {!isCompleted && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pendingMappings.length > 0 && (
              <button className="btn btn-success" onClick={handleConfirmAll}>
                一键确认所有待确认座位
              </button>
            )}
            <button 
              className="btn btn-primary" 
              onClick={handleComplete}
              disabled={!canComplete}
            >
              完成换厅
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="alert alert-danger">
          ⚠️ {actionError}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          ✅ {successMessage}
        </div>
      )}

      {!canComplete && !isCompleted && (
        <div className="alert alert-warning">
          ⚠️ 存在未处理的座位映射（待确认或需人工处理），无法完成换厅。
          请先处理所有座位后再完成换厅。
        </div>
      )}

      <div className="section">
        <h3 className="section-title">📊 换厅概览</h3>
        <div className="exchange-info">
          <div className="exchange-info-item">
            <div className="label">影片</div>
            <div className="value">{request.movie_name}</div>
          </div>
          <div className="exchange-info-item">
            <div className="label">放映时间</div>
            <div className="value">{formatDateTime(request.start_time)}</div>
          </div>
          <div className="exchange-info-item">
            <div className="label">换厅方向</div>
            <div className="value">{request.original_hall} → {request.target_hall}</div>
          </div>
          <div className="exchange-info-item">
            <div className="label">申请状态</div>
            <div className="value">
              <span className={`badge ${request.status === 'completed' ? 'badge-completed' : 'badge-processing'}`}>
                {request.status === 'completed' ? '已完成' : request.status === 'processing' ? '处理中' : request.status}
              </span>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#667eea' }}>{stats.total}</div>
            <div className="stat-label">受影响观众</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ed8936' }}>{stats.pendingConfirm}</div>
            <div className="stat-label">待确认座位</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#e53e3e' }}>{stats.manualRequired}</div>
            <div className="stat-label">需人工处理</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#48bb78' }}>{stats.resolved}</div>
            <div className="stat-label">已完成换厅</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#718096' }}>{stats.refunded}</div>
            <div className="stat-label">已退票</div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">💰 差价明细</h3>
        <div className="card">
          <div className="diff-summary">
            <div className="diff-item">
              <div className="diff-value" style={{ color: stats.totalDiff >= 0 ? '#e53e3e' : '#48bb78' }}>
                {stats.totalDiff >= 0 ? '+' : ''}¥{stats.totalDiff.toFixed(2)}
              </div>
              <div className="diff-label">预计总差价</div>
            </div>
            {stats.totalRefund > 0 && (
              <div className="diff-item">
                <div className="diff-value" style={{ color: '#718096' }}>
                  ¥{stats.totalRefund.toFixed(2)}
                </div>
                <div className="diff-label">已退票金额</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#718096' }}>
            <p>• 正差价：观众需要补交的金额</p>
            <p>• 负差价：需要退还给观众的金额</p>
          </div>
        </div>
      </div>

      {manualMappings.length > 0 && (
        <div className="section">
          <div className="manual-section">
            <h3 className="section-title">⚠️ 人工处理区 ({manualMappings.length}位观众)</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#c05621' }}>
              这些座位无法自动匹配，请人工分配新座位或办理退票
            </p>
            {manualMappings.map(mapping => (
              <div key={mapping.id} className="mapping-card">
                <div className="mapping-header">
                  <div>
                    <strong>{mapping.customer_name || '匿名观众'}</strong>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
                      {mapping.customer_phone || ''}
                    </span>
                    <span className="badge badge-pending" style={{ marginLeft: '0.75rem' }}>
                      原座位: {mapping.original_code}{mapping.original_vip ? ' (VIP)' : ''}
                    </span>
                  </div>
                  <span className="badge badge-manual">{getMappingTypeLabel(mapping.mapping_type)}</span>
                </div>
                <div className="mapping-info">
                  <span>订单: {mapping.order_no}</span>
                  <span>实付: ¥{mapping.paid_price}</span>
                </div>
                {!isCompleted && (
                  <div className="mapping-actions" style={{ marginTop: '0.75rem' }}>
                    <button 
                      className="btn btn-primary btn-small"
                      onClick={() => {
                        setShowAssignModal(mapping);
                        setSelectedSeat(null);
                      }}
                    >
                      分配座位
                    </button>
                    <button 
                      className="btn btn-danger btn-small"
                      onClick={() => handleRefund(mapping.id, '座位无法安排，全额退款')}
                    >
                      全额退票
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingMappings.length > 0 && (
        <div className="section">
          <h3 className="section-title">⏳ 待确认座位 ({pendingMappings.length}位观众)</h3>
          <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#718096' }}>
            这些座位已自动匹配，请确认后完成换厅
          </p>
          {pendingMappings.map(mapping => (
            <div key={mapping.id} className="mapping-card">
              <div className="mapping-header">
                <div>
                  <strong>{mapping.customer_name || '匿名观众'}</strong>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
                    {mapping.customer_phone || ''}
                  </span>
                </div>
                <span className="badge badge-pending">待确认</span>
              </div>
              <div className="mapping-info">
                <span>
                  原座位: <strong>{mapping.original_code}{mapping.original_vip ? ' (VIP)' : ''}</strong>
                </span>
                <span>→</span>
                <span>
                  新座位: <strong>{mapping.new_code}{mapping.new_vip ? ' (VIP)' : ''}</strong>
                </span>
                <span>
                  匹配方式: <span className="badge badge-processing">{getMappingTypeLabel(mapping.mapping_type)}</span>
                </span>
              </div>
              <div className="mapping-info" style={{ marginTop: '0.5rem' }}>
                <span>订单: {mapping.order_no}</span>
                <span>实付: ¥{mapping.paid_price}</span>
                {mapping.price_diff !== 0 && (
                  <span className={`price-diff ${mapping.price_diff > 0 ? 'price-diff-positive' : 'price-diff-negative'}`}>
                    差价: {mapping.price_diff > 0 ? '+' : ''}¥{mapping.price_diff.toFixed(2)}
                    {mapping.price_diff > 0 ? ' (需补交)' : ' (退还)'}
                  </span>
                )}
              </div>
              {!isCompleted && (
                <div className="mapping-actions" style={{ marginTop: '0.75rem' }}>
                  <button 
                    className="btn btn-success btn-small"
                    onClick={() => handleConfirm(mapping.id)}
                  >
                    确认该座位
                  </button>
                  <button 
                    className="btn btn-danger btn-small"
                    onClick={() => handleRefund(mapping.id, '观众放弃换厅')}
                  >
                    改为退票
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {resolvedMappings.length > 0 && (
        <div className="section">
          <h3 className="section-title">✅ 已处理 ({resolvedMappings.length}位观众)</h3>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>观众</th>
                    <th>电话</th>
                    <th>原座位</th>
                    <th>新座位/结果</th>
                    <th>差价</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedMappings.map(mapping => {
                    const status = getStatusBadge(mapping.status);
                    return (
                      <tr key={mapping.id}>
                        <td>{mapping.customer_name || '-'}</td>
                        <td>{mapping.customer_phone || '-'}</td>
                        <td>{mapping.original_code}{mapping.original_vip ? ' (VIP)' : ''}</td>
                        <td>
                          {mapping.status === 'refunded' 
                            ? `退票 ¥${mapping.refund_amount?.toFixed(2) || 0}`
                            : `${mapping.new_code}${mapping.new_vip ? ' (VIP)' : ''}`
                          }
                        </td>
                        <td>
                          {mapping.status === 'refunded' ? (
                            <span style={{ color: '#718096' }}>全额退款</span>
                          ) : mapping.price_diff === 0 ? (
                            <span>-</span>
                          ) : (
                            <span className={`price-diff ${mapping.price_diff > 0 ? 'price-diff-positive' : 'price-diff-negative'}`}>
                              {mapping.price_diff > 0 ? '+' : ''}¥{mapping.price_diff.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${status.class}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="section">
          <h3 className="section-title">📱 通知模拟结果</h3>
          <div className="card">
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#718096' }}>
              以下是系统已发送给观众的模拟短信通知
            </p>
            <NotificationList />
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => { setShowAssignModal(null); setSelectedSeat(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>分配座位给 {showAssignModal.customer_name || '观众'}</h3>
              <button className="modal-close" onClick={() => { setShowAssignModal(null); setSelectedSeat(null); }}>&times;</button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fffbeb', borderRadius: '8px' }}>
              <p><strong>原座位:</strong> {showAssignModal.original_code}{showAssignModal.original_vip ? ' (VIP)' : ''}</p>
              <p><strong>订单号:</strong> {showAssignModal.order_no}</p>
              <p><strong>实付金额:</strong> ¥{showAssignModal.paid_price}</p>
            </div>

            <p style={{ marginBottom: '0.5rem', color: '#4a5568' }}>请在下图中选择一个可用座位:</p>
            {renderSeatGridForSelection(showAssignModal)}

            {selectedSeat && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0fff4', borderRadius: '8px' }}>
                已选择: {targetHallSeats.find(s => s.id === selectedSeat)?.seat_code}
              </div>
            )}

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setShowAssignModal(null); setSelectedSeat(null); }}
              >
                取消
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => {
                  handleRefund(showAssignModal.id, '座位无法安排，全额退款');
                  setShowAssignModal(null);
                  setSelectedSeat(null);
                }}
              >
                全额退票
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleAssign(showAssignModal.id)}
                disabled={!selectedSeat}
              >
                确认分配
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationList() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/notifications');
      setNotifications(await res.json());
    };
    load();
  }, []);

  if (notifications.length === 0) {
    return <p style={{ color: '#718096' }}>暂无通知记录</p>;
  }

  return (
    <div>
      {notifications.map(n => (
        <div key={n.id} className={`notification-item ${n.status}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <strong>{n.title}</strong>
            <span style={{ fontSize: '0.75rem', color: '#718096' }}>
              发送至: {n.target || '未知'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#4a5568' }}>{n.content}</p>
        </div>
      ))}
    </div>
  );
}
