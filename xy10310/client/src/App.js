import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const API_BASE = '/api';

function App() {
  const [currentTab, setCurrentTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState([]);
  const [todos, setTodos] = useState({});
  const [customers, setCustomers] = useState([]);
  const [materialTypes, setMaterialTypes] = useState([]);
  const [statusConfig, setStatusConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleDetail, setVehicleDetail] = useState(null);
  const [showCollectMaterialModal, setShowCollectMaterialModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showInspectionResultModal, setShowInspectionResultModal] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentTab === 'vehicles') {
      loadVehicles();
    } else if (currentTab === 'todos') {
      loadTodos();
    }
  }, [currentTab]);

  const loadInitialData = async () => {
    try {
      const [materialsRes, statusRes] = await Promise.all([
        axios.get(`${API_BASE}/material-types`),
        axios.get(`${API_BASE}/statuses`)
      ]);
      setMaterialTypes(materialsRes.data.types);
      setStatusConfig({
        statuses: statusRes.data.statuses,
        statusNames: statusRes.data.statusNames,
        transitions: statusRes.data.transitions
      });
      loadVehicles();
    } catch (error) {
      showAlert('加载数据失败', 'error');
    }
  };

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/vehicles`);
      setVehicles(res.data.data);
    } catch (error) {
      showAlert('加载车辆列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTodos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/todos`);
      setTodos(res.data.data);
    } catch (error) {
      showAlert('加载待办事项失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchText = !filterText || 
      v.plate_number.includes(filterText) || 
      v.customer_name.includes(filterText) ||
      v.customer_phone.includes(filterText);
    const matchStatus = !filterStatus || v.status === filterStatus;
    return matchText && matchStatus;
  });

  const exportData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/export`);
      const data = res.data.data;
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '车辆年检数据');
      XLSX.writeFile(workbook, `车辆年检数据_${dayjs().format('YYYYMMDD')}.xlsx`);
      showAlert('导出成功');
    } catch (error) {
      showAlert('导出失败', 'error');
    }
  };

  const handleViewDetail = async (vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const res = await axios.get(`${API_BASE}/vehicles/${vehicle.id}`);
      setVehicleDetail(res.data.data);
      setCurrentTab('detail');
    } catch (error) {
      showAlert('加载详情失败', 'error');
    }
  };

  const handleCreateVehicle = async (data) => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/customers`, {
        name: data.customer_name,
        phone: data.customer_phone,
        id_card: data.customer_id_card,
        address: data.customer_address
      });
      const customersRes = await axios.get(`${API_BASE}/customers`);
      const customer = customersRes.data.data.find(c => c.phone === data.customer_phone);
      
      if (!customer) {
        throw new Error('客户创建失败');
      }

      await axios.post(`${API_BASE}/vehicles`, {
        customer_id: customer.id,
        plate_number: data.plate_number,
        brand: data.brand,
        model: data.model,
        year: parseInt(data.year),
        vin: data.vin,
        engine_number: data.engine_number
      });

      showAlert('车辆创建成功');
      setShowCreateModal(false);
      loadVehicles();
    } catch (error) {
      showAlert(error.response?.data?.message || '创建失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectMaterials = async (vehicleId, materialTypes) => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/vehicles/${vehicleId}/collect-materials`, {
        material_types: materialTypes
      });
      showAlert('材料收集成功');
      setShowCollectMaterialModal(false);
      const res = await axios.get(`${API_BASE}/vehicles/${vehicleId}`);
      setVehicleDetail(res.data.data);
      loadVehicles();
    } catch (error) {
      showAlert(error.response?.data?.message || '收集材料失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = async (data) => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/vehicles/${selectedVehicle.id}/appointments`, {
        vehicle_id: selectedVehicle.id,
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
        inspection_station: data.inspection_station
      });
      showAlert('预约成功');
      setShowAppointmentModal(false);
      const res = await axios.get(`${API_BASE}/vehicles/${selectedVehicle.id}`);
      setVehicleDetail(res.data.data);
      loadVehicles();
    } catch (error) {
      showAlert(error.response?.data?.message || '预约失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInspectionResult = async (data) => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/vehicles/${selectedVehicle.id}/inspection-result`, {
        result: data.result,
        failure_reason: data.failure_reason
      });
      showAlert(data.result === 'passed' ? '检测通过已记录' : '检测失败已记录');
      setShowInspectionResultModal(false);
      const res = await axios.get(`${API_BASE}/vehicles/${selectedVehicle.id}`);
      setVehicleDetail(res.data.data);
      loadVehicles();
    } catch (error) {
      showAlert(error.response?.data?.message || '记录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectCertificate = async () => {
    if (!selectedVehicle) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/vehicles/${selectedVehicle.id}/collect-certificate`);
      showAlert('已取证');
      const res = await axios.get(`${API_BASE}/vehicles/${selectedVehicle.id}`);
      setVehicleDetail(res.data.data);
      loadVehicles();
    } catch (error) {
      showAlert(error.response?.data?.message || '操作失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = (vehicle) => {
    const status = vehicle.status;
    const actions = [];
    
    if (vehicleDetail && status === 'certificate_collected') {
      return actions;
    }

    if (['created', 'materials_collected'].includes(status) && vehicleDetail) {
      const uncollectedMaterials = vehicleDetail.materials.filter(m => !m.is_collected);
      if (uncollectedMaterials.length > 0) {
        actions.push({
          key: 'collect_materials',
          label: '收集材料',
          onClick: () => setShowCollectMaterialModal(true)
        });
      }
    }

    if (status === 'materials_collected') {
      actions.push({
        key: 'schedule_appointment',
        label: '安排检测预约',
        onClick: () => setShowAppointmentModal(true)
      });
    }

    if (status === 'inspection_failed') {
      actions.push({
        key: 'schedule_appointment',
        label: '安排重约',
        onClick: () => setShowAppointmentModal(true)
      });
    }

    if (['appointment_scheduled', 'retest_scheduled'].includes(status)) {
      actions.push({
        key: 'record_inspection',
        label: '记录检测结果',
        onClick: () => setShowInspectionResultModal(true)
      });
    }

    if (status === 'inspection_completed') {
      actions.push({
        key: 'collect_certificate',
        label: '确认取证',
        onClick: handleCollectCertificate
      });
    }

    return actions;
  };

  return (
    <div>
      <div className="header">
        <div className="container">
          <h1>车辆年检代办进度台</h1>
          <div className="user-info">当前用户：客服小张</div>
        </div>
      </div>

      <div className="container">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        {currentTab !== 'detail' && (
          <div className="nav-tabs">
            <div 
              className={`nav-tab ${currentTab === 'vehicles' ? 'active' : ''}`}
              onClick={() => setCurrentTab('vehicles')}
            >
              车辆列表
            </div>
            <div 
              className={`nav-tab ${currentTab === 'todos' ? 'active' : ''}`}
              onClick={() => setCurrentTab('todos')}
            >
              待办事项
            </div>
          </div>
        )}

        {loading && <div className="card">加载中...</div>}

        {currentTab === 'vehicles' && !loading && (
          <VehicleListPage
            vehicles={filteredVehicles}
            statusConfig={statusConfig}
            onViewDetail={handleViewDetail}
            onExport={exportData}
            onCreateVehicle={() => setShowCreateModal(true)}
            filterText={filterText}
            setFilterText={setFilterText}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />
        )}

        {currentTab === 'todos' && !loading && (
          <TodosPage
            todos={todos}
            onViewDetail={handleViewDetail}
          />
        )}

        {currentTab === 'detail' && vehicleDetail && !loading && (
          <VehicleDetailPage
            vehicle={vehicleDetail}
            statusConfig={statusConfig}
            onBack={() => {
              setCurrentTab('vehicles');
              setSelectedVehicle(null);
              setVehicleDetail(null);
            }}
            actions={getAvailableActions(vehicleDetail.vehicle)}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateVehicleModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateVehicle}
        />
      )}

      {showCollectMaterialModal && vehicleDetail && (
        <CollectMaterialModal
          vehicle={vehicleDetail}
          materialTypes={materialTypes}
          onClose={() => setShowCollectMaterialModal(false)}
          onSubmit={handleCollectMaterials}
        />
      )}

      {showAppointmentModal && selectedVehicle && (
        <CreateAppointmentModal
          vehicle={selectedVehicle}
          onClose={() => setShowAppointmentModal(false)}
          onSubmit={handleCreateAppointment}
        />
      )}

      {showInspectionResultModal && selectedVehicle && (
        <InspectionResultModal
          vehicle={selectedVehicle}
          onClose={() => setShowInspectionResultModal(false)}
          onSubmit={handleInspectionResult}
        />
      )}
    </div>
  );
}

function VehicleListPage({ vehicles, statusConfig, onViewDetail, onExport, onCreateVehicle, filterText, setFilterText, filterStatus, setFilterStatus }) {
  return (
    <div>
      <div className="card">
        <div className="card-title">车辆列表</div>
        
        <div className="filter-section">
          <div className="filter-group">
            <label>搜索</label>
            <input
              type="text"
              className="filter-input"
              placeholder="车牌号/客户名/电话"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>状态</label>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              {statusConfig.statusNames && Object.entries(statusConfig.statusNames).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={onExport}>导出数据</button>
              <button className="btn btn-primary" onClick={onCreateVehicle}>新增车辆</button>
            </div>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无车辆数据
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>车牌号</th>
                <th>客户姓名</th>
                <th>联系电话</th>
                <th>品牌车型</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(vehicle => (
                <tr key={vehicle.id}>
                  <td><strong>{vehicle.plate_number}</strong></td>
                  <td>{vehicle.customer_name}</td>
                  <td>{vehicle.customer_phone}</td>
                  <td>{vehicle.brand} {vehicle.model}</td>
                  <td>
                    <span className={`status-badge status-${vehicle.status}`}>
                      {vehicle.status_name}
                    </span>
                  </td>
                  <td>{dayjs(vehicle.updated_at).format('YYYY-MM-DD HH:mm')}</td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => onViewDetail(vehicle)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TodosPage({ todos, onViewDetail }) {
  const todoSections = [
    { key: 'pending_materials', title: '待收集材料', data: todos.pending_materials || [] },
    { key: 'pending_appointment', title: '待预约检测', data: todos.pending_appointment || [] },
    { key: 'pending_inspection', title: '待检测', data: todos.pending_inspection || [] },
    { key: 'pending_certificate', title: '待取证', data: todos.pending_certificate || [] }
  ];

  return (
    <div className="todo-section">
      {todoSections.map(section => (
        <div key={section.key} className="todo-card">
          <div className="todo-card-header">
            <div className="todo-card-title">{section.title}</div>
            <span className="todo-count">{section.data.length}</span>
          </div>
          {section.data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              暂无待办
            </div>
          ) : (
            section.data.map(item => (
              <div 
                key={item.id} 
                className="todo-item"
                onClick={() => onViewDetail(item)}
              >
                <div>
                  <div className="todo-plate">{item.plate_number}</div>
                  <div className="todo-info">{item.customer_name} - {item.customer_phone}</div>
                </div>
                {section.key === 'pending_materials' && (
                  <div className="todo-info">还需 {item.pending_count} 份材料</div>
                )}
                {section.key === 'pending_inspection' && item.appointment && (
                  <div className="todo-info">
                    {dayjs(item.appointment.appointment_date).format('MM-DD')} {item.appointment.appointment_time || ''}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function VehicleDetailPage({ vehicle, statusConfig, onBack, actions }) {
  const { vehicle: v, materials, appointments, status_history, operation_logs } = vehicle;
  const currentStatus = v.status;

  const getTimelineItemClass = (status, isLast) => {
    if (isLast) return 'current';
    if (status === 'inspection_failed') return 'failed';
    return 'passed';
  };

  return (
    <div>
      <div className="back-btn" onClick={onBack}>
        <span>←</span> 返回列表
      </div>

      <div className="card">
        <div className="card-title">
          车辆详情
          <span className={`status-badge status-${currentStatus}`} style={{ marginLeft: 'auto' }}>
            {v.status_name}
          </span>
        </div>
        <div className="detail-grid">
          <div>
            <div className="detail-item">
              <div className="detail-label">车牌号</div>
              <div className="detail-value">{v.plate_number}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">品牌型号</div>
              <div className="detail-value">{v.brand} {v.model}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">年份</div>
              <div className="detail-value">{v.year}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">VIN码</div>
              <div className="detail-value">{v.vin}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">发动机号</div>
              <div className="detail-value">{v.engine_number}</div>
            </div>
          </div>
          <div>
            <div className="detail-item">
              <div className="detail-label">客户姓名</div>
              <div className="detail-value">{v.customer_name}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">联系电话</div>
              <div className="detail-value">{v.customer_phone}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">身份证号</div>
              <div className="detail-value">{v.customer_id_card}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">地址</div>
              <div className="detail-value">{v.customer_address}</div>
            </div>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="actions" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
            {actions.map(action => (
              <button 
                key={action.key}
                className={`btn ${action.key === 'collect_certificate' ? 'btn-success' : 'btn-primary'}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">材料收集情况</div>
        <div className="material-list">
          {materials.map(material => (
            <div key={material.id} className={`material-item ${material.is_collected ? 'collected' : ''}`}>
              <div className="material-icon">
                {material.is_collected ? '✓' : '○'}
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>{material.material_type}</div>
                {material.is_collected && material.collected_at && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {dayjs(material.collected_at).format('YYYY-MM-DD HH:mm')} 收集
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {appointments.length > 0 && (
        <div className="card">
          <div className="card-title">检测预约记录</div>
          {appointments.map(appointment => (
            <div 
              key={appointment.id} 
              className={`appointment-card ${
                appointment.status === 'passed' ? 'appointment-status-passed' : 
                appointment.status === 'failed' ? 'appointment-status-failed' : ''
              }`}
            >
              <div className="detail-grid">
                <div>
                  <div className="detail-item">
                    <div className="detail-label">预约日期</div>
                    <div className="detail-value">{appointment.appointment_date}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">预约时间</div>
                    <div className="detail-value">{appointment.appointment_time || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">检测站</div>
                    <div className="detail-value">{appointment.inspection_station}</div>
                  </div>
                </div>
                <div>
                  <div className="detail-item">
                    <div className="detail-label">结果</div>
                    <div className="detail-value">
                      {appointment.inspection_result || '待检测'}
                    </div>
                  </div>
                  {appointment.failure_reason && (
                    <div className="detail-item">
                      <div className="detail-label">失败原因</div>
                      <div className="detail-value" style={{ color: '#dc2626' }}>
                        {appointment.failure_reason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">状态时间线</div>
        <div className="timeline">
          {status_history.map((status, index) => (
            <div 
              key={status.id} 
              className={`timeline-item ${getTimelineItemClass(status.status, index === status_history.length - 1)}`}
            >
              <div className="timeline-time">{dayjs(status.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
              <div className="timeline-content">
                <strong>{status.status_name}</strong>
                {status.notes && (
                  <div style={{ marginTop: '4px', color: '#666' }}>
                    备注：{status.notes}
                  </div>
                )}
              </div>
              <div className="timeline-meta">
                操作人：{status.operator} | 来源：{status.source}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">操作日志</div>
        {operation_logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无操作日志
          </div>
        ) : (
          operation_logs.map(log => (
            <div key={log.id} className="operation-log-item">
              <div className="operation-log-info">
                <div className="operation-log-action">{log.action}</div>
                {log.details && (
                  <div className="operation-log-details">{log.details}</div>
                )}
              </div>
              <div className="operation-log-meta">
                <div>{dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                <div>{log.operator}</div>
                <div>{log.source}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateVehicleModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    plate_number: '',
    brand: '',
    model: '',
    year: '',
    vin: '',
    engine_number: '',
    customer_name: '',
    customer_phone: '',
    customer_id_card: '',
    customer_address: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">新增车辆</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">车牌号 *</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.plate_number}
                onChange={e => setForm({ ...form, plate_number: e.target.value })}
                placeholder="如：京A12345"
              />
            </div>
            <div className="form-group">
              <label className="form-label">品牌</label>
              <input
                type="text"
                className="form-input"
                value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value })}
                placeholder="如：大众"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">型号</label>
              <input
                type="text"
                className="form-input"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="如：朗逸"
              />
            </div>
            <div className="form-group">
              <label className="form-label">年份</label>
              <input
                type="number"
                className="form-input"
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
                placeholder="如：2020"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">VIN码</label>
              <input
                type="text"
                className="form-input"
                value={form.vin}
                onChange={e => setForm({ ...form, vin: e.target.value })}
                placeholder="车架号"
              />
            </div>
            <div className="form-group">
              <label className="form-label">发动机号</label>
              <input
                type="text"
                className="form-input"
                value={form.engine_number}
                onChange={e => setForm({ ...form, engine_number: e.target.value })}
              />
            </div>
          </div>
          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">客户姓名 *</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.customer_name}
                onChange={e => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">联系电话 *</label>
              <input
                type="tel"
                className="form-input"
                required
                value={form.customer_phone}
                onChange={e => setForm({ ...form, customer_phone: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">身份证号</label>
              <input
                type="text"
                className="form-input"
                value={form.customer_id_card}
                onChange={e => setForm({ ...form, customer_id_card: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">地址</label>
              <input
                type="text"
                className="form-input"
                value={form.customer_address}
                onChange={e => setForm({ ...form, customer_address: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">创建</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectMaterialModal({ vehicle, materialTypes, onClose, onSubmit }) {
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  const uncollectedMaterials = vehicle.materials.filter(m => !m.is_collected);

  const handleToggle = (materialType) => {
    if (selectedMaterials.includes(materialType)) {
      setSelectedMaterials(selectedMaterials.filter(m => m !== materialType));
    } else {
      setSelectedMaterials([...selectedMaterials, materialType]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedMaterials.length === 0) {
      alert('请至少选择一项材料');
      return;
    }
    onSubmit(vehicle.vehicle.id, selectedMaterials);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">收集材料</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">选择要收集的材料</label>
            {uncollectedMaterials.length === 0 ? (
              <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
                所有材料已收集完毕
              </div>
            ) : (
              <div className="checkbox-group">
                {uncollectedMaterials.map(material => (
                  <div
                    key={material.id}
                    className={`checkbox-item ${selectedMaterials.includes(material.material_type) ? 'selected' : ''}`}
                    onClick={() => handleToggle(material.material_type)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMaterials.includes(material.material_type)}
                      onChange={() => {}}
                    />
                    <span>{material.material_type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={uncollectedMaterials.length === 0}
            >
              确认收集
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateAppointmentModal({ vehicle, onClose, onSubmit }) {
  const [form, setForm] = useState({
    appointment_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    appointment_time: '09:00',
    inspection_station: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">安排检测预约</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">预约日期 *</label>
              <input
                type="date"
                className="form-input"
                required
                value={form.appointment_date}
                onChange={e => setForm({ ...form, appointment_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">预约时间</label>
              <select
                className="form-select"
                value={form.appointment_time}
                onChange={e => setForm({ ...form, appointment_time: e.target.value })}
              >
                <option value="09:00">09:00</option>
                <option value="10:00">10:00</option>
                <option value="11:00">11:00</option>
                <option value="14:00">14:00</option>
                <option value="15:00">15:00</option>
                <option value="16:00">16:00</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">检测站 *</label>
            <select
              className="form-select"
              required
              value={form.inspection_station}
              onChange={e => setForm({ ...form, inspection_station: e.target.value })}
            >
              <option value="">请选择检测站</option>
              <option value="北京市第一检测场">北京市第一检测场</option>
              <option value="北京市第二检测场">北京市第二检测场</option>
              <option value="北京市第三检测场">北京市第三检测场</option>
              <option value="北京市第四检测场">北京市第四检测场</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">确认预约</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InspectionResultModal({ vehicle, onClose, onSubmit }) {
  const [form, setForm] = useState({
    result: 'passed',
    failure_reason: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.result === 'failed' && !form.failure_reason.trim()) {
      alert('请输入失败原因');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">记录检测结果</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">检测结果</label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="result"
                  value="passed"
                  checked={form.result === 'passed'}
                  onChange={e => setForm({ ...form, result: e.target.value })}
                />
                <span>通过</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="result"
                  value="failed"
                  checked={form.result === 'failed'}
                  onChange={e => setForm({ ...form, result: e.target.value })}
                />
                <span>未通过</span>
              </label>
            </div>
          </div>
          {form.result === 'failed' && (
            <div className="form-group">
              <label className="form-label">失败原因 *</label>
              <textarea
                className="form-textarea"
                required
                value={form.failure_reason}
                onChange={e => setForm({ ...form, failure_reason: e.target.value })}
                placeholder="请详细描述检测失败的原因"
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button 
              type="submit" 
              className={`btn ${form.result === 'passed' ? 'btn-success' : 'btn-danger'}`}
            >
              确认记录
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
