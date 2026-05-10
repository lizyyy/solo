import React, { useState, useEffect } from 'react';
import { keyApi, orderApi, auditApi } from '../services/api';
import moment from 'moment';

const KeysPage = () => {
  const [keys, setKeys] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [formData, setFormData] = useState({
    operator: '',
    operatorRole: 'cleaner',
    orderId: '',
    expectedReturnTime: '',
    remarks: '',
  });
  const [message, setMessage] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keysRes, ordersRes] = await Promise.all([
        keyApi.getAll(),
        orderApi.getAvailable(),
      ]);
      setKeys(keysRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      showMessage('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleOpenModal = (type, key) => {
    setModalType(type);
    setSelectedKey(key);
    setFormData({
      operator: '',
      operatorRole: type === 'pickup' ? 'cleaner' : 'admin',
      orderId: '',
      expectedReturnTime: '',
      remarks: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.operator) {
      showMessage('error', '请填写操作人姓名');
      return;
    }

    try {
      if (modalType === 'pickup') {
        if (formData.operatorRole === 'cleaner' && !formData.orderId) {
          showMessage('error', '保洁员领取必须关联订单');
          return;
        }
        
        await keyApi.pickup(selectedKey.id, {
          operator: { name: formData.operator, role: formData.operatorRole },
          orderId: formData.orderId || null,
          expectedReturnTime: formData.expectedReturnTime || null,
          remarks: formData.remarks,
        });
        showMessage('success', '钥匙领取成功！');
      } else if (modalType === 'return') {
        await keyApi.return(selectedKey.id, {
          operator: { name: formData.operator },
          remarks: formData.remarks,
        });
        showMessage('success', '钥匙归还成功！');
      }
      
      setShowModal(false);
      loadData();
    } catch (error) {
      showMessage('error', error.response?.data?.error || '操作失败');
    }
  };

  const handleViewTimeline = async (key) => {
    try {
      const res = await auditApi.getKeyTimeline(key.id);
      setTimeline(res.data);
      setShowTimeline(true);
    } catch (error) {
      showMessage('error', '获取时间线失败');
    }
  };

  const filteredKeys = keys.filter(key => {
    const matchesFilter = filter === 'all' || key.status === filter;
    const matchesSearch = search === '' || 
      key.keyCode.toLowerCase().includes(search.toLowerCase()) ||
      key.customerName.toLowerCase().includes(search.toLowerCase()) ||
      key.address.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusText = (status) => {
    const map = {
      available: '可用',
      in_use: '使用中',
      overdue: '逾期',
      maintenance: '维护中',
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">钥匙柜管理</h2>
        </div>
        
        <div className="filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="搜索钥匙编号、客户名或地址..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="select-dropdown"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="available">可用</option>
            <option value="in_use">使用中</option>
            <option value="overdue">逾期</option>
            <option value="maintenance">维护中</option>
          </select>
          <button className="btn btn-primary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>

        <div className="key-cabinet">
          {filteredKeys.map(key => (
            <div key={key.id} className={`key-card ${key.status}`}>
              <span className={`key-status ${key.status}`}>
                {getStatusText(key.status)}
              </span>
              <div className="key-info">
                <strong>编号：</strong>{key.keyCode}
              </div>
              <div className="key-info">
                <strong>客户：</strong>{key.customerName}
              </div>
              <div className="key-info">
                <strong>地址：</strong>{key.address}
              </div>
              <div className="key-info">
                <strong>位置：</strong>{key.cabinetNumber}
              </div>
              {key.notes && (
                <div className="key-info text-muted">
                  <strong>备注：</strong>{key.notes}
                </div>
              )}
              
              <div className="key-actions">
                {key.status === 'available' && (
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => handleOpenModal('pickup', key)}
                  >
                    📤 领取
                  </button>
                )}
                {(key.status === 'in_use' || key.status === 'overdue') && (
                  <button 
                    className="btn btn-warning btn-sm"
                    onClick={() => handleOpenModal('return', key)}
                  >
                    📥 归还
                  </button>
                )}
                <button 
                  className="btn btn-info btn-sm"
                  onClick={() => handleViewTimeline(key)}
                >
                  📜 历史
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredKeys.length === 0 && (
          <div className="text-center text-muted py-5">
            没有找到匹配的钥匙
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {modalType === 'pickup' ? '钥匙领取' : '钥匙归还'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">钥匙信息</label>
                <div className="form-control" style={{ background: '#f8f9fa' }}>
                  {selectedKey.keyCode} - {selectedKey.customerName}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">操作人姓名 *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.operator}
                  onChange={(e) => setFormData({...formData, operator: e.target.value})}
                  required
                />
              </div>

              {modalType === 'pickup' && (
                <>
                  <div className="form-group">
                    <label className="form-label">操作人角色</label>
                    <select
                      className="form-control"
                      value={formData.operatorRole}
                      onChange={(e) => setFormData({...formData, operatorRole: e.target.value})}
                    >
                      <option value="cleaner">保洁员</option>
                      <option value="admin">管理员</option>
                      <option value="supervisor">主管</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      关联订单 {formData.operatorRole === 'cleaner' ? '*' : '(可选)'}
                    </label>
                    <select
                      className="form-control"
                      value={formData.orderId}
                      onChange={(e) => setFormData({...formData, orderId: e.target.value})}
                      required={formData.operatorRole === 'cleaner'}
                    >
                      <option value="">{formData.operatorRole === 'cleaner' ? '请选择订单' : '不关联订单（临时借用）'}</option>
                      {orders.map(order => (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} - {order.serviceType} ({order.cleanerName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">预计归还时间 (可选)</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={formData.expectedReturnTime}
                      onChange={(e) => setFormData({...formData, expectedReturnTime: e.target.value})}
                    />
                  </div>
                </>
              )}

              {modalType === 'return' && selectedKey.status === 'overdue' && (
                <div className="alert alert-warning">
                  ⚠️ 此钥匙已逾期，归还时必须填写备注说明原因
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  备注 {(modalType === 'return' && selectedKey.status === 'overdue') ? '*' : '(可选)'}
                </label>
                <textarea
                  className="form-control form-textarea"
                  value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  required={modalType === 'return' && selectedKey.status === 'overdue'}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button 
                  type="submit" 
                  className={modalType === 'pickup' ? 'btn btn-success' : 'btn btn-warning'}
                >
                  {modalType === 'pickup' ? '确认领取' : '确认归还'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTimeline && timeline && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                钥匙时间线 - {timeline.keyInfo.keyCode}
              </h3>
              <button className="modal-close" onClick={() => setShowTimeline(false)}>
                ×
              </button>
            </div>
            
            <div className="card">
              <div className="key-info">
                <strong>客户：</strong>{timeline.keyInfo.customerName}
              </div>
              <div className="key-info">
                <strong>地址：</strong>{timeline.keyInfo.address}
              </div>
              <div className="key-info">
                <strong>当前状态：</strong>
                <span className={`badge ${
                  timeline.keyInfo.currentStatus === 'available' ? 'badge-success' :
                  timeline.keyInfo.currentStatus === 'overdue' ? 'badge-danger' : 'badge-warning'
                }`}>
                  {getStatusText(timeline.keyInfo.currentStatus)}
                </span>
              </div>
            </div>

            <h4 style={{ marginBottom: '1rem' }}>交接历史</h4>
            <div className="timeline">
              {timeline.timeline.map((item, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-time">{item.time}</div>
                  <div className="timeline-title">
                    {item.type} - {item.operator}
                  </div>
                  <div className="timeline-content">
                    {item.orderNumber && <div>订单：{item.orderNumber}</div>}
                    {item.remarks && item.remarks !== '-' && <div>备注：{item.remarks}</div>}
                    {item.action && <div>操作：{item.action}</div>}
                  </div>
                </div>
              ))}
              {timeline.timeline.length === 0 && (
                <p className="text-muted">暂无交接记录</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeysPage;
