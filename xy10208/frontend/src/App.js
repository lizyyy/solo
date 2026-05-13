import React, { useState, useEffect, useCallback } from 'react';
import './index.css';

const API_BASE = '/api';
const CABINET_ID = 'cabinet-001';

const STATUS_LABELS = {
  full: '满电',
  empty: '空槽',
  reserved: '已预约',
  occupied: '使用中',
  fault: '故障',
  locked: '锁定',
  released: '已释放'
};

const FLOW_STEPS = [
  { key: 'idle', label: '空闲', desc: '等待预约' },
  { key: 'reservation_confirmed', label: '预约确认', desc: '槽位已锁定' },
  { key: 'waiting_empty_battery', label: '等待归还', desc: '请插入空电池' },
  { key: 'empty_battery_inserted', label: '归还完成', desc: '空电池已接收' },
  { key: 'waiting_full_battery', label: '等待取电', desc: '请取出满电电池' },
  { key: 'completed', label: '完成', desc: '换电流程结束' }
];

const fetchJSON = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return response.json();
};

function App() {
  const [cabinet, setCabinet] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [history, setHistory] = useState([]);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('reservations');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [modalOpen, setModalOpen] = useState(null);
  const [formData, setFormData] = useState({
    riderName: '',
    riderPhone: '',
    batteryCode: '',
    faultReason: '',
    reviewAction: 'approve'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cabinetRes, resRes, histRes] = await Promise.all([
        fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}`),
        fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/reservations`),
        fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/history`)
      ]);
      
      if (cabinetRes.success) setCabinet(cabinetRes.data);
      if (resRes.success) setReservations(resRes.data);
      if (histRes.success) setHistory(histRes.data);
    } catch (error) {
      showAlert('error', '加载数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadDemoScenario = async (scenario) => {
    const result = await fetchJSON(`${API_BASE}/demo/load`, {
      method: 'POST',
      body: JSON.stringify({ scenario })
    });
    
    if (result.success) {
      showAlert('success', result.message);
      loadData();
    } else {
      showAlert('error', result.error);
    }
  };

  const resetDemo = async () => {
    const result = await fetchJSON(`${API_BASE}/demo/reset`, { method: 'POST' });
    if (result.success) {
      showAlert('success', result.message);
      setSelectedSlot(null);
      loadData();
    }
  };

  const checkTimeout = async () => {
    const result = await fetchJSON(`${API_BASE}/timeout-check`, {
      method: 'POST',
      body: JSON.stringify({ cabinetId: CABINET_ID })
    });
    
    if (result.success) {
      if (result.data.expired.length > 0) {
        showAlert('warning', `已释放 ${result.data.expired.length} 个超时预约`);
      } else {
        showAlert('info', '当前没有超时预约');
      }
      loadData();
    }
  };

  const createReservation = async () => {
    if (!formData.riderName || !formData.riderPhone) {
      showAlert('error', '请填写骑手姓名和手机号');
      return;
    }

    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/reservations`, {
      method: 'POST',
      body: JSON.stringify({
        riderName: formData.riderName,
        riderPhone: formData.riderPhone
      })
    });

    if (result.success) {
      showAlert('success', `预约成功！取电槽位: ${result.data.reserveSlot}, 归还槽位: ${result.data.returnSlot}`);
      setFormData({ ...formData, riderName: '', riderPhone: '' });
      setModalOpen(null);
      loadData();
    } else {
      showAlert('error', result.error);
      if (result.suggestion) {
        setTimeout(() => showAlert('info', '建议: ' + result.suggestion), 300);
      }
    }
  };

  const returnBattery = async (reservation) => {
    if (!formData.batteryCode) {
      showAlert('error', '请输入电池编号');
      return;
    }

    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/reservations/${reservation.id}/return`, {
      method: 'POST',
      body: JSON.stringify({
        slotNumber: reservation.returnSlot,
        batteryCode: formData.batteryCode
      })
    });

    if (result.success) {
      showAlert('success', result.data.message + ' ' + result.data.nextStep);
      setFormData({ ...formData, batteryCode: '' });
      setModalOpen(null);
      loadData();
    } else {
      showAlert('error', result.error);
      if (result.currentStatus === 'NEEDS_REVIEW') {
        showAlert('warning', '触发待复核状态，需要运营人员处理');
      }
      if (result.suggestion) {
        setTimeout(() => showAlert('info', '建议: ' + result.suggestion), 300);
      }
      loadData();
    }
  };

  const takeBattery = async (reservation) => {
    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/reservations/${reservation.id}/take`, {
      method: 'POST',
      body: JSON.stringify({ slotNumber: reservation.reserveSlot })
    });

    if (result.success) {
      showAlert('success', `${result.data.message} 电池编号: ${result.data.battery.code}`);
      setModalOpen(null);
      loadData();
    } else {
      showAlert('error', result.error);
      if (result.currentStatus === 'NEEDS_REVIEW') {
        showAlert('warning', '触发待复核状态，需要运营人员处理');
      }
      if (result.suggestion) {
        setTimeout(() => showAlert('info', '建议: ' + result.suggestion), 300);
      }
      loadData();
    }
  };

  const cancelReservation = async (reservation) => {
    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/reservations/${reservation.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: '用户取消' })
    });

    if (result.success) {
      showAlert('success', result.data.message);
      setModalOpen(null);
      loadData();
    } else {
      showAlert('error', result.error);
    }
  };

  const markSlotFault = async () => {
    if (!formData.faultReason || !selectedSlot) {
      showAlert('error', '请选择槽位并填写故障原因');
      return;
    }

    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/slots/${selectedSlot.slotNumber}/fault`, {
      method: 'POST',
      body: JSON.stringify({ reason: formData.faultReason })
    });

    if (result.success) {
      showAlert('success', result.data.message);
      setFormData({ ...formData, faultReason: '' });
      setModalOpen(null);
      loadData();
    } else {
      showAlert('error', result.error);
    }
  };

  const releaseSlotFault = async (slotNumber) => {
    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/slots/${slotNumber}/fault`, {
      method: 'DELETE',
      body: JSON.stringify({})
    });

    if (result.success) {
      showAlert('success', result.data.message);
      loadData();
    } else {
      showAlert('error', result.error);
    }
  };

  const reviewReservation = async (reservation) => {
    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/reservations/${reservation.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: formData.reviewAction })
    });

    if (result.success) {
      showAlert('success', result.data.message);
      setModalOpen(null);
      loadData();
    } else {
      showAlert('error', result.error);
    }
  };

  const generateReport = async () => {
    const result = await fetchJSON(`${API_BASE}/cabinets/${CABINET_ID}/report`);
    if (result.success) {
      setReport(result.data);
      showAlert('success', '报表已生成');
    }
  };

  const exportReport = () => {
    if (!report) return;
    
    const content = JSON.stringify(report, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `换电柜报表_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('success', '报表已导出');
  };

  const getSlotClass = (status) => `slot-status-${status}`;
  const getReservationStatusClass = (status) => `status-${status.replace(/_/g, '-')}`;

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!cabinet) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="panel">
          <h2>🔋 加载中...</h2>
          <p>正在连接换电柜数据服务器</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="header">
        <h1>🔋 电动车换电柜槽位分配台</h1>
        <p>{cabinet.name} - 实时监控与运营管理</p>
      </div>

      <div className="demo-controls">
        <button className="btn btn-secondary" onClick={() => loadDemoScenario('normal')}>
          🌱 加载正常场景
        </button>
        <button className="btn btn-warning" onClick={() => loadDemoScenario('mixed')}>
          ⚠️ 加载混合场景
        </button>
        <button className="btn btn-danger" onClick={checkTimeout}>
          ⏰ 检查超时
        </button>
        <button className="btn btn-primary" onClick={resetDemo}>
          🔄 重置演示
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' && '✅'}
          {alert.type === 'error' && '❌'}
          {alert.type === 'warning' && '⚠️'}
          {alert.type === 'info' && 'ℹ️'}
          {alert.message}
        </div>
      )}

      <div className="main-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>📦 换电柜状态</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen('reservation')}>
              + 新建预约
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card full">
              <div className="stat-value">{cabinet.stats?.full || 0}</div>
              <div className="stat-label">满电槽位</div>
            </div>
            <div className="stat-card empty">
              <div className="stat-value">{cabinet.stats?.empty || 0}</div>
              <div className="stat-label">空槽位</div>
            </div>
            <div className="stat-card reserved">
              <div className="stat-value">{cabinet.stats?.reserved || 0}</div>
              <div className="stat-label">已预约</div>
            </div>
            <div className="stat-card fault">
              <div className="stat-value">{cabinet.stats?.fault || 0}</div>
              <div className="stat-label">故障</div>
            </div>
          </div>

          <div className="cabinet-grid">
            {cabinet.slots?.map((slot) => (
              <div
                key={slot.id}
                className={`slot ${getSlotClass(slot.status)} ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                onClick={() => setSelectedSlot(slot)}
              >
                <div className="slot-number">#{slot.slotNumber}</div>
                <div className="slot-status">{STATUS_LABELS[slot.status]}</div>
                {slot.reservationId && (
                  <div className="slot-badge badge-reservation">预</div>
                )}
                {slot.status === 'fault' && (
                  <div className="slot-badge badge-fault">!</div>
                )}
              </div>
            ))}
          </div>

          {selectedSlot && (
            <div className="slot-detail" style={{ marginTop: '25px' }}>
              <div className="panel-header">
                <h3>🔍 槽位 #{selectedSlot.slotNumber} 详情</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedSlot.status === 'fault' ? (
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={() => releaseSlotFault(selectedSlot.slotNumber)}
                    >
                      解除故障
                    </button>
                  ) : (
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => setModalOpen('markFault')}
                    >
                      标记故障
                    </button>
                  )}
                </div>
              </div>
              <div className="detail-row">
                <span className="detail-label">状态</span>
                <span className="detail-value">{STATUS_LABELS[selectedSlot.status]}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">流程状态</span>
                <span className="detail-value">{selectedSlot.currentFlow || '无'}</span>
              </div>
              {selectedSlot.reservationId && (
                <div className="detail-row">
                  <span className="detail-label">关联预约</span>
                  <span className="detail-value">{selectedSlot.reservationId.substr(0, 8)}...</span>
                </div>
              )}
              {selectedSlot.faultReason && (
                <div className="alert alert-error">
                  <strong>故障原因:</strong> {selectedSlot.faultReason}
                </div>
              )}
              {selectedSlot.battery && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">电池编号</span>
                    <span className="detail-value">{selectedSlot.battery.code}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">电池电量</span>
                    <span className="detail-value">{selectedSlot.battery.soc}%</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">电池健康</span>
                    <span className="detail-value">{selectedSlot.battery.health}%</span>
                  </div>
                </>
              )}
              <div className="detail-row">
                <span className="detail-label">最后更新</span>
                <span className="detail-value">{formatTime(selectedSlot.updatedAt)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'reservations' ? 'active' : ''}`}
              onClick={() => setActiveTab('reservations')}
            >
              📋 预约管理
            </button>
            <button 
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 历史记录
            </button>
            <button 
              className={`tab ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => { setActiveTab('report'); generateReport(); }}
            >
              📊 运营报表
            </button>
          </div>

          {activeTab === 'reservations' && (
            <div className="reservation-list">
              {reservations.length === 0 ? (
                <div className="alert alert-info">当前没有预约记录</div>
              ) : (
                reservations.slice().reverse().map((res) => (
                  <div 
                    key={res.id} 
                    className={`reservation-item ${res.status === 'needs_review' ? 'pending-review' : ''}`}
                  >
                    <div className="reservation-header">
                      <span className="reservation-rider">
                        🏍️ {res.riderName} ({res.riderPhone})
                      </span>
                      <span className={`reservation-status ${getReservationStatusClass(res.status)}`}>
                        {res.status}
                      </span>
                    </div>
                    <div className="reservation-details">
                      <div>取电: #{res.reserveSlot}</div>
                      <div>归还: #{res.returnSlot}</div>
                      <div>创建: {formatTime(res.createdAt)}</div>
                      <div>过期: {formatTime(res.expiresAt)}</div>
                    </div>
                    
                    {res.status === 'needs_review' && (
                      <div className="alert alert-warning" style={{ marginTop: '10px' }}>
                        ⚠️ 该预约触发异常，需要运营复核
                      </div>
                    )}

                    <div style={{ marginTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {res.status === 'confirmed' && (
                        <>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => { setSelectedSlot(res); setModalOpen('return'); }}
                          >
                            归还电池
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => cancelReservation(res)}
                          >
                            取消预约
                          </button>
                        </>
                      )}
                      {res.status === 'in_progress' && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => takeBattery(res)}
                        >
                          取出满电电池
                        </button>
                      )}
                      {res.status === 'needs_review' && (
                        <>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSelectedSlot(res); setModalOpen('review'); }}
                          >
                            运营复核
                          </button>
                        </>
                      )}
                    </div>

                    {res.status !== 'completed' && res.status !== 'expired' && res.status !== 'cancelled' && res.status !== 'failed' && (
                      <div className="flow-steps" style={{ marginTop: '15px' }}>
                        {FLOW_STEPS.map((step, idx) => {
                          const currentIdx = FLOW_STEPS.findIndex(s => s.key === res.currentFlow);
                          const stepIdx = idx;
                          let className = 'pending';
                          if (step.key === res.currentFlow) className = 'active';
                          else if (stepIdx < currentIdx) className = 'completed';
                          if (res.currentFlow === 'fault' || res.currentFlow === 'timeout') {
                            if (step.key === res.currentFlow) className = 'fault';
                          }
                          
                          return (
                            <div key={step.key} className={`flow-step ${className}`}>
                              <div className="step-number">{idx + 1}</div>
                              <div className="step-content">
                                <h4>{step.label}</h4>
                                <p>{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-list">
              {history.length === 0 ? (
                <div className="alert alert-info">当前没有历史记录</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="history-item">
                    <div className="history-time">{formatTime(item.timestamp)}</div>
                    <div className="history-action">{item.action}</div>
                    <div className="history-details">{item.details}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'report' && report && (
            <div>
              <div className="report-summary">
                <div className="report-card">
                  <h3>总预约数</h3>
                  <div className="report-value">{report.summary.totalReservations}</div>
                  <div className="report-sub">本月</div>
                </div>
                <div className="report-card">
                  <h3>成功率</h3>
                  <div className="report-value">{report.summary.successRate}%</div>
                  <div className="report-sub">完成率</div>
                </div>
                <div className="report-card">
                  <h3>待复核</h3>
                  <div className="report-value">{report.summary.needsReview}</div>
                  <div className="report-sub">需处理</div>
                </div>
              </div>

              <div className="panel">
                <h4 style={{ marginBottom: '15px' }}>📈 统计详情</h4>
                <div className="detail-row">
                  <span className="detail-label">完成</span>
                  <span className="detail-value">{report.summary.completed}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">取消</span>
                  <span className="detail-value">{report.summary.cancelled}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">超时</span>
                  <span className="detail-value">{report.summary.expired}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">失败</span>
                  <span className="detail-value">{report.summary.failed}</span>
                </div>
              </div>

              {report.faultSlots.length > 0 && (
                <div className="fault-list">
                  <h4>⚠️ 当前故障槽位</h4>
                  {report.faultSlots.map((fault) => (
                    <div key={fault.slotNumber} className="fault-item">
                      <span>槽位 #{fault.slotNumber}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {fault.faultReason}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button 
                className="btn btn-primary" 
                style={{ marginTop: '20px', width: '100%' }}
                onClick={exportReport}
              >
                📥 导出报表
              </button>
            </div>
          )}
        </div>
      </div>

      {modalOpen === 'reservation' && (
        <div className="modal-overlay" onClick={() => setModalOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 新建换电预约</h3>
              <button className="modal-close" onClick={() => setModalOpen(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>骑手姓名</label>
                <input
                  type="text"
                  value={formData.riderName}
                  onChange={(e) => setFormData({ ...formData, riderName: e.target.value })}
                  placeholder="请输入骑手姓名"
                />
              </div>
              <div className="form-group">
                <label>手机号</label>
                <input
                  type="tel"
                  value={formData.riderPhone}
                  onChange={(e) => setFormData({ ...formData, riderPhone: e.target.value })}
                  placeholder="请输入手机号"
                />
              </div>
              <div className="alert alert-info">
                💡 系统将自动分配可用的取电槽位和归还槽位
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(null)}>取消</button>
              <button className="btn btn-primary" onClick={createReservation}>确认预约</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen === 'return' && (
        <div className="modal-overlay" onClick={() => setModalOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔋 归还空电池</h3>
              <button className="modal-close" onClick={() => setModalOpen(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                请将电池插入 <strong>槽位 #{selectedSlot?.returnSlot}</strong>
              </div>
              <div className="form-group">
                <label>电池编号</label>
                <input
                  type="text"
                  value={formData.batteryCode}
                  onChange={(e) => setFormData({ ...formData, batteryCode: e.target.value })}
                  placeholder="请输入电池编号 (如 BAT-XXXX)"
                />
              </div>
              <div className="suggestion">
                <h4>💡 提示</h4>
                <p>
                  ✅ <strong>正常流程</strong>：输入普通电池编号（如 `BAT-001`、`TEST-123`），电量为 10%<br/>
                  ⚠️ <strong>触发高电量拦截</strong>：输入以 <strong>HIGH</strong> 开头的编号（如 `HIGH-001`、`HIGHTEST`），强制电量 85-99%，触发待复核
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(null)}>取消</button>
              <button className="btn btn-primary" onClick={() => returnBattery(selectedSlot)}>确认归还</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen === 'markFault' && (
        <div className="modal-overlay" onClick={() => setModalOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ 标记槽位故障</h3>
              <button className="modal-close" onClick={() => setModalOpen(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                即将标记 <strong>槽位 #{selectedSlot?.slotNumber}</strong> 为故障状态
              </div>
              <div className="form-group">
                <label>故障原因</label>
                <textarea
                  value={formData.faultReason}
                  onChange={(e) => setFormData({ ...formData, faultReason: e.target.value })}
                  placeholder="请描述故障原因"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(null)}>取消</button>
              <button className="btn btn-danger" onClick={markSlotFault}>确认标记</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen === 'review' && (
        <div className="modal-overlay" onClick={() => setModalOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 运营复核</h3>
              <button className="modal-close" onClick={() => setModalOpen(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                该预约触发异常，需要运营人员复核
              </div>
              <div className="form-group">
                <label>复核操作</label>
                <select
                  value={formData.reviewAction}
                  onChange={(e) => setFormData({ ...formData, reviewAction: e.target.value })}
                >
                  <option value="approve">✅ 批准 - 允许继续换电</option>
                  <option value="reject">❌ 拒绝 - 终止换电流程</option>
                </select>
              </div>
              {formData.reviewAction === 'reject' && (
                <div className="alert alert-error">
                  拒绝后，该预约将被终止，归还的电池将被标记为待处理
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(null)}>取消</button>
              <button 
                className={`btn ${formData.reviewAction === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => reviewReservation(selectedSlot)}
              >
                确认复核
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;