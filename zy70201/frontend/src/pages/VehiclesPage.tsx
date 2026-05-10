import { useEffect, useState } from 'react';
import { vehicleApi } from '../services/api';
import type { Vehicle, VehicleStatus } from '../types';
import { vehicleStatusLabels } from '../types';

function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      const res = await vehicleApi.getAll();
      setVehicles(res.data.data);
    } catch (error: any) {
      setAlert({ type: 'error', message: '加载车辆列表失败: ' + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get('name') as string,
      model: formData.get('model') as string,
      status: formData.get('status') as VehicleStatus,
      capacityPerHour: parseFloat(formData.get('capacityPerHour') as string),
      currentLocation: formData.get('currentLocation') as string
    };

    try {
      if (editingVehicle) {
        await vehicleApi.update(editingVehicle.id, data);
        setAlert({ type: 'success', message: '车辆信息更新成功' });
      } else {
        await vehicleApi.create(data);
        setAlert({ type: 'success', message: '车辆创建成功' });
      }
      setShowModal(false);
      setEditingVehicle(null);
      loadVehicles();
    } catch (error: any) {
      setAlert({ type: 'error', message: '操作失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这台车辆吗？')) return;
    
    try {
      await vehicleApi.delete(id);
      setAlert({ type: 'success', message: '车辆删除成功' });
      loadVehicles();
    } catch (error: any) {
      setAlert({ type: 'error', message: '删除失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleReportBreakdown(id: string) {
    if (!confirm('确定要报告该车辆故障吗？系统会自动将该车辆的任务重新分配到待分配队列。')) return;
    
    try {
      const res = await vehicleApi.reportBreakdown(id);
      setAlert({ type: 'success', message: res.data.data.message });
      loadVehicles();
    } catch (error: any) {
      setAlert({ type: 'error', message: '操作失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  function openEditModal(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setShowModal(true);
  }

  function openCreateModal() {
    setEditingVehicle(null);
    setShowModal(true);
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">车辆状态</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + 新增车辆
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>车辆名称</th>
                  <th>型号</th>
                  <th>每小时作业能力</th>
                  <th>当前位置</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.name}</td>
                    <td>{vehicle.model}</td>
                    <td>{vehicle.capacityPerHour.toLocaleString()} ㎡/h</td>
                    <td>{vehicle.currentLocation}</td>
                    <td>
                      <span className="badge" style={{ 
                        backgroundColor: getVehicleStatusBgColor(vehicle.status),
                        color: getVehicleStatusTextColor(vehicle.status)
                      }}>
                        {vehicleStatusLabels[vehicle.status]}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(vehicle)}>
                          编辑
                        </button>
                        {vehicle.status !== 'BROKEN' && (
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => handleReportBreakdown(vehicle.id)}
                          >
                            报告故障
                          </button>
                        )}
                        <button 
                          className="btn btn-danger btn-sm" 
                          onClick={() => handleDelete(vehicle.id)}
                          disabled={vehicle.status === 'WORKING'}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onClose={() => { setShowModal(false); setEditingVehicle(null); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function VehicleFormModal({ vehicle, onClose, onSubmit }: {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{vehicle ? '编辑车辆' : '新增车辆'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">车辆名称</label>
              <input 
                type="text" 
                name="name" 
                className="form-input" 
                defaultValue={vehicle?.name}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">型号</label>
              <input 
                type="text" 
                name="model" 
                className="form-input" 
                defaultValue={vehicle?.model}
                required
              />
            </div>
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">每小时作业能力 (㎡/h)</label>
                <input 
                  type="number" 
                  name="capacityPerHour" 
                  className="form-input" 
                  defaultValue={vehicle?.capacityPerHour}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">状态</label>
                <select name="status" className="form-select" defaultValue={vehicle?.status || 'AVAILABLE'}>
                  <option value="AVAILABLE">可用</option>
                  <option value="MAINTENANCE">维修中</option>
                  <option value="WORKING">作业中</option>
                  <option value="BROKEN">故障</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">当前位置</label>
              <input 
                type="text" 
                name="currentLocation" 
                className="form-input" 
                defaultValue={vehicle?.currentLocation}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getVehicleStatusBgColor(status: string) {
  const colors: Record<string, string> = {
    AVAILABLE: '#ecfdf5',
    MAINTENANCE: '#fffbeb',
    WORKING: '#eff6ff',
    BROKEN: '#fef2f2'
  };
  return colors[status] || '#f3f4f6';
}

function getVehicleStatusTextColor(status: string) {
  const colors: Record<string, string> = {
    AVAILABLE: '#065f46',
    MAINTENANCE: '#92400e',
    WORKING: '#1e40af',
    BROKEN: '#991b1b'
  };
  return colors[status] || '#374151';
}

export default VehiclesPage;
