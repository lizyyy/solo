import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workOrdersAPI } from '../api.js';

function WorkOrders() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '全部',
    repairCategory: '全部',
    search: ''
  });
  const [formData, setFormData] = useState({
    repairType: '水管',
    repairCategory: '公共区域',
    location: '',
    description: '',
    reporterName: '',
    reporterPhone: '',
    houseNumber: '',
    technician: ''
  });

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      const response = await workOrdersAPI.getAll(filters);
      if (response.data.success) {
        setWorkOrders(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkOrders();
  }, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await workOrdersAPI.create(formData);
      if (response.data.success) {
        setShowModal(false);
        loadWorkOrders();
        setFormData({
          repairType: '水管',
          repairCategory: '公共区域',
          location: '',
          description: '',
          reporterName: '',
          reporterPhone: '',
          houseNumber: '',
          technician: ''
        });
      }
    } catch (err) {
      alert('创建失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      '待处理': 'badge-pending',
      '处理中': 'badge-progress',
      '待确认': 'badge-confirm',
      '已完成': 'badge-completed',
      '已取消': 'badge-cancelled'
    };
    return badges[status] || 'badge-cancelled';
  };

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📋 工单管理</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 新建工单
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="filters">
            <div className="filter-group">
              <span className="filter-label">状态:</span>
              <select 
                className="select"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="全部">全部</option>
                <option value="待处理">待处理</option>
                <option value="处理中">处理中</option>
                <option value="待确认">待确认</option>
                <option value="已完成">已完成</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">类别:</span>
              <select 
                className="select"
                value={filters.repairCategory}
                onChange={(e) => setFilters({...filters, repairCategory: e.target.value})}
              >
                <option value="全部">全部</option>
                <option value="公共区域">公共区域</option>
                <option value="住户自费">住户自费</option>
              </select>
            </div>
            <div className="filter-group">
              <input 
                type="text" 
                className="input"
                placeholder="搜索工单号/地点/师傅..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-body">
          {workOrders.length === 0 ? (
            <div className="empty-state">暂无工单数据</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>工单号</th>
                    <th>维修类型</th>
                    <th>类别</th>
                    <th>地点</th>
                    <th>报修人</th>
                    <th>维修师傅</th>
                    <th>状态</th>
                    <th>已结算</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map(wo => (
                    <tr key={wo._id}>
                      <td className="number">{wo.orderNumber}</td>
                      <td>{wo.repairType}</td>
                      <td>
                        <span className={`badge ${wo.repairCategory === '公共区域' ? 'badge-public' : 'badge-private'}`}>
                          {wo.repairCategory}
                        </span>
                      </td>
                      <td>{wo.location}</td>
                      <td>{wo.reporterName}</td>
                      <td>{wo.technician}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(wo.status)}`}>
                          {wo.status}
                        </span>
                      </td>
                      <td>
                        {wo.settled ? (
                          <span className={`badge ${wo.settlementType === '业主付费' ? 'badge-owner' : wo.settlementType === '公共维修基金' ? 'badge-fund' : 'badge-cancelled'}`}>
                            {wo.settlementType}
                          </span>
                        ) : (
                          <span className="badge badge-pending">未结算</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/work-orders/${wo._id}`)}
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">新建维修工单</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form className="modal-body form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">维修类型</label>
                  <select 
                    className="form-select"
                    value={formData.repairType}
                    onChange={(e) => setFormData({...formData, repairType: e.target.value})}
                  >
                    <option value="水管">水管</option>
                    <option value="门禁">门禁</option>
                    <option value="照明">照明</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">维修类别</label>
                  <select 
                    className="form-select"
                    value={formData.repairCategory}
                    onChange={(e) => setFormData({...formData, repairCategory: e.target.value})}
                  >
                    <option value="公共区域">公共区域</option>
                    <option value="住户自费">住户自费</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">维修地点 *</label>
                <input 
                  type="text"
                  className="form-input"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="如：1号楼2单元楼道"
                />
              </div>
              {formData.repairCategory === '住户自费' && (
                <div className="form-group">
                  <label className="form-label">房号</label>
                  <input 
                    type="text"
                    className="form-input"
                    value={formData.houseNumber}
                    onChange={(e) => setFormData({...formData, houseNumber: e.target.value})}
                    placeholder="如：3-502"
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">问题描述</label>
                <textarea 
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="请描述维修问题..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">报修人 *</label>
                  <input 
                    type="text"
                    className="form-input"
                    required
                    value={formData.reporterName}
                    onChange={(e) => setFormData({...formData, reporterName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">联系电话</label>
                  <input 
                    type="text"
                    className="form-input"
                    value={formData.reporterPhone}
                    onChange={(e) => setFormData({...formData, reporterPhone: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">指派维修师傅 *</label>
                <input 
                  type="text"
                  className="form-input"
                  required
                  value={formData.technician}
                  onChange={(e) => setFormData({...formData, technician: e.target.value})}
                  placeholder="如：张师傅"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  创建工单
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrders;
