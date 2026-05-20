import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { slotsApi, systemsApi, locksApi } from '../api';
import { useAppStore } from '../store';

export default function Slots() {
  const navigate = useNavigate();
  const { showNotification } = useAppStore();
  const [slots, setSlots] = useState<any[]>([]);
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    department_id: '',
    date: '',
    status: ''
  });
  const [showLockModal, setShowLockModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [lockForm, setLockForm] = useState({
    patient_id: '',
    patient_name: '',
    operator_id: '',
    operator_name: ''
  });

  useEffect(() => {
    loadData();
    loadSystems();
  }, [filters]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await slotsApi.getSlots(filters);
      setSlots(res.data.data?.data || []);
    } catch (error) {
      console.error('加载号源失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSystems() {
    try {
      const res = await systemsApi.getSystems({ status: 'active' });
      setSystems(res.data.data?.data || []);
    } catch (error) {
      console.error('加载系统失败:', error);
    }
  }

  async function handleLock() {
    if (!selectedSlot) return;
    
    try {
      await locksApi.createLock({
        slot_id: selectedSlot.id,
        ...lockForm
      });
      showNotification('success', '锁号成功');
      setShowLockModal(false);
      loadData();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '锁号失败');
    }
  }

  async function handlePullSlots() {
    if (systems.length === 0) {
      showNotification('error', '请先创建外部系统');
      return;
    }
    
    try {
      await slotsApi.pullSlots({
        external_system_id: systems[0].id,
        date: new Date().toISOString().split('T')[0]
      });
      showNotification('success', '号源拉取成功');
      loadData();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '拉取失败');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📋 号源管理</h2>
        <button className="btn btn-primary" onClick={handlePullSlots}>
          从外部系统拉取号源
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="科室ID"
            value={filters.department_id}
            onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
          />
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="available">可用</option>
            <option value="full">已满</option>
          </select>
          <button className="btn btn-secondary" onClick={() => setFilters({ department_id: '', date: '', status: '' })}>
            重置
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>科室</th>
                <th>日期</th>
                <th>时段</th>
                <th>总数</th>
                <th>可用</th>
                <th>已锁</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <td>{slot.department_name}</td>
                  <td>{slot.date}</td>
                  <td>{slot.time_slot}</td>
                  <td>{slot.total_count}</td>
                  <td>{slot.available_count}</td>
                  <td>{slot.locked_count}</td>
                  <td>
                    <span className={`badge badge-${slot.status}`}>
                      {slot.status === 'available' ? '可用' : '已满'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigate(`/slots/${slot.id}`)}
                      style={{ marginRight: '8px' }}
                    >
                      详情
                    </button>
                    {slot.status === 'available' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setShowLockModal(true);
                        }}
                      >
                        锁号
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {slots.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    暂无号源数据，请先从外部系统拉取
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showLockModal && (
        <div className="modal-overlay" onClick={() => setShowLockModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔒 锁号确认</h3>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p><strong>科室:</strong> {selectedSlot?.department_name}</p>
              <p><strong>日期:</strong> {selectedSlot?.date}</p>
              <p><strong>时段:</strong> {selectedSlot?.time_slot}</p>
              <p><strong>剩余可用:</strong> {selectedSlot?.available_count}</p>
            </div>
            <div className="form-group">
              <label>患者ID</label>
              <input
                type="text"
                value={lockForm.patient_id}
                onChange={(e) => setLockForm({ ...lockForm, patient_id: e.target.value })}
                placeholder="请输入患者ID"
              />
            </div>
            <div className="form-group">
              <label>患者姓名</label>
              <input
                type="text"
                value={lockForm.patient_name}
                onChange={(e) => setLockForm({ ...lockForm, patient_name: e.target.value })}
                placeholder="请输入患者姓名"
              />
            </div>
            <div className="form-group">
              <label>操作人ID</label>
              <input
                type="text"
                value={lockForm.operator_id}
                onChange={(e) => setLockForm({ ...lockForm, operator_id: e.target.value })}
                placeholder="请输入操作人ID"
              />
            </div>
            <div className="form-group">
              <label>操作人姓名</label>
              <input
                type="text"
                value={lockForm.operator_name}
                onChange={(e) => setLockForm({ ...lockForm, operator_name: e.target.value })}
                placeholder="请输入操作人姓名"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLockModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleLock}>
                确认锁号
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
