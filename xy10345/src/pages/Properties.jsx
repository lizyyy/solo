import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertyApi, orderApi, passwordApi } from '../services/api';
import { getPropertyStatusBadge, formatDateTime } from '../utils/helpers';

function Properties() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [orders, setOrders] = useState([]);
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
    try {
      const [ordersRes, passwordsRes] = await Promise.all([
        orderApi.getAll({ propertyId: property.id }),
        passwordApi.getAll({ propertyId: property.id })
      ]);
      setOrders(ordersRes.data);
      setPasswords(passwordsRes.data);
    } catch (error) {
      console.error('加载房源详情失败:', error);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>🏠 房源管理</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
        <div>
          <div className="card">
            <h3 className="card-title">房源列表</h3>
            {properties.length === 0 ? (
              <div className="empty-state">
                <p>暂无房源</p>
              </div>
            ) : (
              properties.map(property => {
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
                    <p>📍 {property.address}</p>
                    <p>👥 最多容纳 {property.maxGuests} 人</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          {!selectedProperty ? (
            <div className="select-property-hint">
              <p>👈 请从左侧选择一个房源查看详情</p>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/calendar')}
              >
                📅 打开日历管理订单
              </button>
            </div>
          ) : (
            <>
              <div className="card">
                <h3 className="card-title">📋 {selectedProperty.name} - 详情</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  <div>
                    <p className="text-muted text-sm">地址</p>
                    <p>{selectedProperty.address}</p>
                  </div>
                  <div>
                    <p className="text-muted text-sm">状态</p>
                    <span className={`badge ${getPropertyStatusBadge(selectedProperty.status).class}`}>
                      {getPropertyStatusBadge(selectedProperty.status).label}
                    </span>
                  </div>
                  <div>
                    <p className="text-muted text-sm">最大入住人数</p>
                    <p>{selectedProperty.maxGuests} 人</p>
                  </div>
                </div>
                
                <div className="mt-4" style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/calendar')}
                  >
                    📅 查看日历
                  </button>
                  <button 
                    className="btn btn-success"
                    onClick={() => navigate('/create-password')}
                  >
                    🔑 生成密码
                  </button>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">📦 相关订单</h3>
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <p>暂无订单</p>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>客人</th>
                        <th>入住时间</th>
                        <th>退房时间</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td>{order.guestName}</td>
                          <td>{formatDateTime(order.checkIn)}</td>
                          <td>{formatDateTime(order.checkOut)}</td>
                          <td>
                            <span className={`badge ${order.status === 'active' ? 'badge-success' : order.status === 'upcoming' ? 'badge-info' : 'badge-secondary'}`}>
                              {order.status === 'active' ? '入住中' : order.status === 'upcoming' ? '待入住' : '已完成'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card">
                <h3 className="card-title">🔐 相关密码</h3>
                {passwords.length === 0 ? (
                  <div className="empty-state">
                    <p>暂无密码</p>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>类型</th>
                        <th>密码</th>
                        <th>有效期</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passwords.map(pwd => (
                        <tr key={pwd.id}>
                          <td>{pwd.name}</td>
                          <td>
                            {pwd.type === 'guest' ? '客人' : pwd.type === 'cleaning' ? '保洁' : '维修'}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{pwd.code}</span>
                          </td>
                          <td className="text-sm text-muted">
                            {formatDateTime(pwd.validFrom)}<br/>
                            至 {formatDateTime(pwd.validTo)}
                          </td>
                          <td>
                            <span className={`badge ${pwd.validation?.status === 'active' ? 'badge-success' : pwd.validation?.status === 'pending' ? 'badge-warning' : 'badge-secondary'}`}>
                              {pwd.validation?.status === 'active' ? '生效中' : pwd.validation?.status === 'pending' ? '待生效' : pwd.status === 'revoked' ? '已作废' : '已过期'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Properties;
