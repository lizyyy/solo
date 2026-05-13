import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tireApi, vehicleApi, exportToCSV } from '../api';
import { Tire, TireStatus, STATUS_LABELS, STATUS_COLORS, Vehicle } from '../types';

const TireList: React.FC = () => {
  const [tires, setTires] = useState<Tire[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ status?: TireStatus; vehicle_id?: string }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTire, setNewTire] = useState({ serial_number: '', brand: '', model: '', size: '' });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      const [tiresData, vehiclesData] = await Promise.all([
        tireApi.getAll(filters),
        vehicleApi.getAll(),
      ]);
      setTires(tiresData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await tireApi.create(newTire);
      setShowCreateModal(false);
      setNewTire({ serial_number: '', brand: '', model: '', size: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const handleExport = () => {
    const exportData = tires.map(t => ({
      胎号: t.serial_number,
      品牌: t.brand,
      型号: t.model,
      规格: t.size,
      状态: STATUS_LABELS[t.current_status],
      创建时间: t.created_at.split('T')[0],
    }));
    exportToCSV(exportData, '轮胎清单');
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
            轮胎管理
          </h2>
          <p style={{ color: '#6b7280' }}>管理所有轮胎的全生命周期</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            📥 导出CSV
          </button>
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
            + 新增轮胎
          </button>
        </div>
      </div>

      <div style={{ 
        background: 'white', 
        padding: '16px 20px', 
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>状态筛选</label>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as TireStatus || undefined }))}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minWidth: '140px',
            }}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>所属车辆</label>
          <select
            value={filters.vehicle_id || ''}
            onChange={(e) => setFilters(f => ({ ...f, vehicle_id: e.target.value || undefined }))}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minWidth: '140px',
            }}
          >
            <option value="">全部车辆</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate_number}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setFilters({})}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            marginTop: '18px',
          }}
        >
          重置筛选
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
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>胎号</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>品牌</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>型号</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>规格</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>状态</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {tires.map(tire => (
                <tr key={tire.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937', fontFamily: 'monospace' }}>{tire.serial_number}</div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#6b7280' }}>{tire.brand}</td>
                  <td style={{ padding: '16px 20px', color: '#6b7280' }}>{tire.model}</td>
                  <td style={{ padding: '16px 20px', color: '#6b7280' }}>{tire.size}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: STATUS_COLORS[tire.current_status] + '20',
                      color: STATUS_COLORS[tire.current_status],
                    }}>
                      {STATUS_LABELS[tire.current_status]}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button
                      onClick={() => navigate(`/tires/${tire.id}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      查看详情 →
                    </button>
                  </td>
                </tr>
              ))}
              {tires.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    暂无轮胎数据
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
            maxWidth: '400px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>新增轮胎</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>胎号</label>
                <input
                  type="text"
                  value={newTire.serial_number}
                  onChange={(e) => setNewTire(n => ({ ...n, serial_number: e.target.value }))}
                  placeholder="例如: TR20240001"
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
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>品牌</label>
                <input
                  type="text"
                  value={newTire.brand}
                  onChange={(e) => setNewTire(n => ({ ...n, brand: e.target.value }))}
                  placeholder="例如: 米其林"
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
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>型号</label>
                <input
                  type="text"
                  value={newTire.model}
                  onChange={(e) => setNewTire(n => ({ ...n, model: e.target.value }))}
                  placeholder="例如: X Line Energy"
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
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>规格</label>
                <input
                  type="text"
                  value={newTire.size}
                  onChange={(e) => setNewTire(n => ({ ...n, size: e.target.value }))}
                  placeholder="例如: 295/80R22.5"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
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
    </div>
  );
};

export default TireList;
