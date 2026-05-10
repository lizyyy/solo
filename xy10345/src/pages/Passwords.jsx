import React, { useState, useEffect } from 'react';
import { propertyApi, passwordApi, orderApi } from '../services/api';
import { 
  formatDateTime, 
  getPasswordTypeLabel, 
  getPasswordStatusBadge,
  getPropertyStatusBadge,
  formatDateForInput,
  generatePasswordExplanation
} from '../utils/helpers';

function Passwords() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [passwords, setPasswords] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [selectedPassword, setSelectedPassword] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [extendData, setExtendData] = useState({ newCheckOut: '' });
  const [revokeReason, setRevokeReason] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const res = await propertyApi.getAll();
      setProperties(res.data);
    } catch (error) {
      console.error('加载房源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectProperty = async (property) => {
    setSelectedProperty(property);
    setSelectedPassword(null);
    try {
      const [passwordsRes, ordersRes] = await Promise.all([
        passwordApi.getAll({ propertyId: property.id }),
        orderApi.getAll({ propertyId: property.id })
      ]);
      setPasswords(passwordsRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      console.error('加载密码失败:', error);
    }
  };

  const handleExtend = async () => {
    if (!selectedPassword || !extendData.newCheckOut) {
      setMessage({ type: 'error', text: '请选择密码和新的退房时间' });
      return;
    }

    const order = orders.find(o => o.id === selectedPassword.orderId);
    if (!order) {
      setMessage({ type: 'error', text: '未找到关联订单' });
      return;
    }

    try {
      const res = await orderApi.extend(order.id, new Date(extendData.newCheckOut).toISOString());
      if (res.data.success) {
        setMessage({ type: 'success', text: '密码延期成功！' });
        setShowExtendModal(false);
        selectProperty(selectedProperty);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || '延期失败，可能与其他密码时间冲突' 
      });
    }
  };

  const handleRevoke = async () => {
    if (!selectedPassword) return;

    try {
      const res = await passwordApi.revoke(selectedPassword.id, revokeReason || '管理员手动作废');
      if (res.data.success) {
        setMessage({ type: 'success', text: '密码已作废！' });
        setShowRevokeModal(false);
        selectProperty(selectedProperty);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '作废失败' });
    }
  };

  const handleVerify = async () => {
    if (!selectedPassword) return;

    try {
      const res = await passwordApi.verify(selectedPassword.id);
      setVerifyResult({
        success: true,
        data: res.data
      });
    } catch (error) {
      setVerifyResult({
        success: false,
        data: error.response?.data
      });
    }
  };

  const filteredPasswords = passwords.filter(pwd => {
    if (filter === 'all') return true;
    return pwd.type === filter;
  });

  const sortedPasswords = [...filteredPasswords].sort((a, b) => {
    const orderA = { active: 0, pending: 1, expired: 2, revoked: 3 };
    const statusA = a.validation?.status || a.status;
    const statusB = b.validation?.status || b.status;
    return orderA[statusA] - orderA[statusB];
  });

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>🔑 密码管理</h2>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div>
          <div className="card">
            <h3 className="card-title">选择房源</h3>
            {properties.map(property => {
              const statusBadge = getPropertyStatusBadge(property.status);
              return (
                <div
                  key={property.id}
                  className={`property-card ${selectedProperty?.id === property.id ? 'active' : ''}`}
                  onClick={() => selectProperty(property)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3>{property.name}</h3>
                    <span className={`badge ${statusBadge.class}`}>{statusBadge.label}</span>
                  </div>
                  <p className="text-sm text-muted">{property.address}</p>
                </div>
              );
            })}
          </div>

          {selectedProperty && (
            <div className="card">
              <h3 className="card-title">筛选类型</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setFilter('all')}
                >
                  全部
                </button>
                <button 
                  className={`btn ${filter === 'guest' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setFilter('guest')}
                >
                  客人密码
                </button>
                <button 
                  className={`btn ${filter === 'cleaning' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setFilter('cleaning')}
                >
                  保洁密码
                </button>
                <button 
                  className={`btn ${filter === 'maintenance' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setFilter('maintenance')}
                >
                  维修密码
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          {!selectedProperty ? (
            <div className="select-property-hint">
              <p>👈 请从左侧选择一个房源查看密码</p>
            </div>
          ) : (
            <>
              {sortedPasswords.length === 0 ? (
                <div className="empty-state">
                  <p>暂无密码记录</p>
                </div>
              ) : (
                <div className="timeline">
                  {sortedPasswords.map(pwd => {
                    const status = pwd.validation?.status || pwd.status;
                    const statusBadge = getPasswordStatusBadge(status);
                    const explanations = generatePasswordExplanation(pwd);
                    
                    return (
                      <div 
                        key={pwd.id} 
                        className={`timeline-item ${status}`}
                        onClick={() => setSelectedPassword(pwd)}
                      >
                        <div className="timeline-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <h4>{pwd.name}</h4>
                              <p><strong>类型：</strong>{getPasswordTypeLabel(pwd.type)}</p>
                              <p><strong>有效期：</strong>{formatDateTime(pwd.validFrom)} 至 {formatDateTime(pwd.validTo)}</p>
                              <p className="password-reason">{pwd.reason}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span className={`badge ${statusBadge.class}`}>{statusBadge.label}</span>
                              <div className="password-display" style={{ marginTop: '10px' }}>
                                <span className="password-code">{pwd.code}</span>
                              </div>
                            </div>
                          </div>

                          <div className="explanation-box">
                            <h4>📋 状态说明</h4>
                            <ul>
                              {explanations.map((exp, idx) => (
                                <li key={idx}>{exp}</li>
                              ))}
                            </ul>
                          </div>

                          {status !== 'revoked' && (
                            <div className="timeline-actions">
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPassword(pwd);
                                  setVerifyResult(null);
                                  setShowVerifyModal(true);
                                }}
                              >
                                🔍 验证密码
                              </button>
                              {pwd.type === 'guest' && status === 'active' && (
                                <button 
                                  className="btn btn-warning btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPassword(pwd);
                                    setExtendData({ newCheckOut: formatDateForInput(new Date(pwd.validTo)) });
                                    setShowExtendModal(true);
                                  }}
                                >
                                  ⏰ 延期退房
                                </button>
                              )}
                              {status !== 'expired' && (
                                <button 
                                  className="btn btn-danger btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPassword(pwd);
                                    setRevokeReason('');
                                    setShowRevokeModal(true);
                                  }}
                                >
                                  🚫 手动作废
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showVerifyModal && selectedPassword && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>密码验证</h3>
              <button className="modal-close" onClick={() => setShowVerifyModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="password-display">
                <span className="password-code">{selectedPassword.code}</span>
                <div className="password-status">
                  <p>{selectedPassword.name}</p>
                  <p>{formatDateTime(selectedPassword.validFrom)} - {formatDateTime(selectedPassword.validTo)}</p>
                </div>
              </div>

              {!verifyResult ? (
                <div className="explanation-box">
                  <h4>⚠️ 验证说明</h4>
                  <ul>
                    <li>系统将模拟门锁验证密码的过程</li>
                    <li>检查密码是否在有效期内</li>
                    <li>检查维修密码是否在维修状态下使用</li>
                    <li>记录任何异常访问尝试</li>
                  </ul>
                </div>
              ) : (
                <div className={`alert ${verifyResult.success ? 'alert-success' : 'alert-danger'}`}>
                  <strong>{verifyResult.success ? '✅ 验证通过' : '❌ 验证失败'}</strong>
                  <p style={{ marginTop: '10px' }}>{verifyResult.data?.message}</p>
                  {verifyResult.data?.validation && (
                    <p className="text-sm mt-4">
                      状态：{verifyResult.data.validation.status} - {verifyResult.data.validation.reason}
                    </p>
                  )}
                  {verifyResult.data?.blocked && (
                    <p className="text-sm mt-4" style={{ color: '#c62828' }}>
                      ⚠️ 此次尝试已被系统拦截并记录到异常日志
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowVerifyModal(false)}
              >
                关闭
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleVerify}
              >
                {verifyResult ? '重新验证' : '执行验证'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExtendModal && selectedPassword && (
        <div className="modal-overlay" onClick={() => setShowExtendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>延期退房</h3>
              <button className="modal-close" onClick={() => setShowExtendModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="explanation-box">
                <h4>⚠️ 延期说明</h4>
                <ul>
                  <li>系统将检查新的退房时间是否与其他密码冲突</li>
                  <li>如果有冲突，延期操作将被拒绝</li>
                  <li>延期成功后，密码有效期将自动延长</li>
                </ul>
              </div>

              <div className="mt-4">
                <div className="form-group">
                  <label className="form-label">当前退房时间</label>
                  <div className="form-input" style={{ backgroundColor: '#f5f7fa' }}>
                    {formatDateTime(selectedPassword.validTo)}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">新的退房时间</label>
                  <input 
                    type="datetime-local" 
                    className="form-input"
                    value={extendData.newCheckOut}
                    onChange={e => setExtendData({ newCheckOut: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowExtendModal(false)}
              >
                取消
              </button>
              <button 
                className="btn btn-warning" 
                onClick={handleExtend}
              >
                确认延期
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevokeModal && selectedPassword && (
        <div className="modal-overlay" onClick={() => setShowRevokeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>手动作废密码</h3>
              <button className="modal-close" onClick={() => setShowRevokeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                ⚠️ 此操作将立即使密码失效，且不可恢复！
              </div>

              <div className="mt-4">
                <div className="form-group">
                  <label className="form-label">密码信息</label>
                  <div className="form-input" style={{ backgroundColor: '#f5f7fa' }}>
                    {selectedPassword.name} - {selectedPassword.code}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">作废原因（可选）</label>
                  <textarea 
                    className="form-input"
                    rows="3"
                    value={revokeReason}
                    onChange={e => setRevokeReason(e.target.value)}
                    placeholder="请输入作废原因..."
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowRevokeModal(false)}
              >
                取消
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleRevoke}
              >
                确认作废
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Passwords;
