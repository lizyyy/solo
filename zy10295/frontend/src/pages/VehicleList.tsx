import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vehicleApi, tireApi } from '../api';
import { Vehicle, Tire } from '../types';

const VehicleList: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleTires, setVehicleTires] = useState<Tire[]>([]);
  const [showTireModal, setShowTireModal] = useState(false);
  const [formData, setFormData] = useState({
    plate_number: '',
    model: '',
    tire_count: 4,
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await vehicleApi.getAll();
      setVehicles(data);
    } catch (error) {
      console.error('加载车辆失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.plate_number || !formData.model) {
        alert('请填写车牌号和车型');
        return;
      }
      await vehicleApi.create(formData);
      setShowCreateModal(false);
      setFormData({ plate_number: '', model: '', tire_count: 4 });
      loadVehicles();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const handleViewTires = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const tires = await tireApi.getAll({ vehicle_id: vehicle.id });
      setVehicleTires(tires);
      setShowTireModal(true);
    } catch (error) {
      console.error('加载车辆轮胎失败:', error);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
            车辆管理
          </h2>
          <p style={{ color: '#6b7280' }}>维护车辆基础数据，管理装车轮胎</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          + 新增车辆
        </button>
      </div>

      <div style={{ 
        background: 'white', 
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>车牌号</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>车型</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>轮胎数量</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>状态</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>创建时间</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(vehicle => (
                <tr key={vehicle.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '16px' }}>
                      {vehicle.plate_number}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#6b7280' }}>{vehicle.model}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ 
                      padding: '4px 12px', 
                      background: '#eff6ff', 
                      color: '#3b82f6', 
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}>
                      {vehicle.tire_count} 个
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                    }}>
                      正常
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#6b7280', fontSize: '13px' }}>
                    {new Date(vehicle.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button
                      onClick={() => handleViewTires(vehicle)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      查看已装轮胎 →
                    </button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚚</div>
                    <div>暂无车辆数据</div>
                    <div style={{ fontSize: '14px', marginTop: '8px' }}>点击右上角"新增车辆"添加第一辆车</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '450px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>新增车辆</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  车牌号 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.plate_number}
                  onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                  placeholder="例如：京A12345"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  车型 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="例如：东风天龙KL"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  轮胎数量
                </label>
                <select
                  value={formData.tire_count}
                  onChange={(e) => setFormData({ ...formData, tire_count: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value={4}>4 个轮胎</option>
                  <option value={6}>6 个轮胎</option>
                  <option value={8}>8 个轮胎</option>
                  <option value={10}>10 个轮胎</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ plate_number: '', model: '', tire_count: 4 });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showTireModal && selectedVehicle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                {selectedVehicle.plate_number} - 已装轮胎
              </h3>
              <button
                onClick={() => setShowTireModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ✕
              </button>
            </div>
            
            {vehicleTires.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛞</div>
                <div>该车暂无已装轮胎</div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>
                  前往轮胎列表页面可以将在库轮胎装车
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vehicleTires.map(tire => (
                  <div
                    key={tire.id}
                    style={{
                      padding: '16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setShowTireModal(false);
                      navigate(`/tires/${tire.id}`);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{tire.serial_number}</div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                          {tire.brand} {tire.model} {tire.size}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                      }}>
                        已装车
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                装车进度：<span style={{ fontWeight: 600, color: '#1f2937' }}>{vehicleTires.length}</span> / {selectedVehicle.tire_count} 个轮胎
              </div>
              <div style={{ 
                width: '100%', 
                height: '8px', 
                background: '#f3f4f6', 
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(vehicleTires.length / selectedVehicle.tire_count) * 100}%`,
                  height: '100%',
                  background: vehicleTires.length === selectedVehicle.tire_count ? '#10b981' : '#3b82f6',
                  borderRadius: '4px',
                  transition: 'width 0.3s',
                }} />
              </div>
              {vehicleTires.length === selectedVehicle.tire_count ? (
                <div style={{ fontSize: '13px', color: '#10b981', marginTop: '8px' }}>
                  ✅ 车辆已装满轮胎，可以出车
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#f59e0b', marginTop: '8px' }}>
                  ⚠️  还缺少 {selectedVehicle.tire_count - vehicleTires.length} 个轮胎
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleList;
