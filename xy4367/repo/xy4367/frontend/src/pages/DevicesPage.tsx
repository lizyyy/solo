import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Device } from '../types';
import { api } from '../services/api';

const deviceTypeLabels: Record<string, string> = {
  telescope: '望远镜',
  camera: '相机',
  mount: '赤道仪',
  filter: '滤镜',
};

export default function DevicesPage() {
  const { devices, fetchDevices } = useAppStore((state) => ({
    devices: state.devices,
    fetchDevices: state.fetchDevices,
  }));

  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'telescope' as Device['type'],
    model: '',
    batteryLevel: 100,
    isAvailable: true,
    description: '',
  });

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (editingDevice) {
      setFormData({
        name: editingDevice.name,
        type: editingDevice.type,
        model: editingDevice.model || '',
        batteryLevel: editingDevice.batteryLevel,
        isAvailable: editingDevice.isAvailable,
        description: editingDevice.description || '',
      });
      setShowForm(true);
    }
  }, [editingDevice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (editingDevice) {
        await api.updateDevice(editingDevice.id, formData);
        setMessage({ type: 'success', text: '设备更新成功' });
      } else {
        await api.createDevice(formData);
        setMessage({ type: 'success', text: '设备添加成功' });
      }
      fetchDevices();
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个设备吗？')) return;

    try {
      await api.deleteDevice(id);
      setMessage({ type: 'success', text: '设备删除成功' });
      fetchDevices();
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败，请重试' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'telescope',
      model: '',
      batteryLevel: 100,
      isAvailable: true,
      description: '',
    });
    setEditingDevice(null);
    setShowForm(false);
  };

  const getBatteryStatusClass = (level: number) => {
    if (level < 30) return 'battery-low';
    if (level < 60) return 'battery-medium';
    return 'battery-high';
  };

  const getBatteryStatusText = (level: number) => {
    if (level < 30) return '低电量';
    if (level < 60) return '电量偏低';
    return '电量充足';
  };

  return (
    <div className="devices-page">
      <div className="page-header">
        <h2>🔧 设备管理</h2>
        <button
          className="primary-button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          + 添加设备
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <div className="modal">
            <h3>{editingDevice ? '编辑设备' : '添加设备'}</h3>
            <form onSubmit={handleSubmit} className="device-form">
              <div className="form-group">
                <label>设备名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="例如：主望远镜"
                />
              </div>

              <div className="form-group">
                <label>设备类型 *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Device['type'] })}
                  required
                >
                  <option value="telescope">望远镜</option>
                  <option value="camera">相机</option>
                  <option value="mount">赤道仪</option>
                  <option value="filter">滤镜</option>
                </select>
              </div>

              <div className="form-group">
                <label>型号</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="例如：Meade 12"
                />
              </div>

              <div className="form-group">
                <label>电量 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.batteryLevel}
                  onChange={(e) => setFormData({ ...formData, batteryLevel: parseInt(e.target.value) || 0 })}
                />
                <div className={`battery-indicator ${getBatteryStatusClass(formData.batteryLevel)}`}>
                  {formData.batteryLevel}% - {getBatteryStatusText(formData.batteryLevel)}
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  />
                  设备可用
                </label>
              </div>

              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="设备描述或备注..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={resetForm}>
                  取消
                </button>
                <button type="submit" className="primary-button" disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="empty-state">
          <p>暂无设备数据</p>
          <p>请通过"添加设备"按钮添加，或在导入页面导入 CSV 文件</p>
        </div>
      ) : (
        <div className="devices-list">
          {devices.map((device) => (
            <div key={device.id} className="device-card">
              <div className="device-header">
                <div>
                  <h4 className="device-name">{device.name}</h4>
                  <span className={`device-type type-${device.type}`}>
                    {deviceTypeLabels[device.type] || device.type}
                  </span>
                </div>
                <div className={`availability-badge ${device.isAvailable ? 'available' : 'unavailable'}`}>
                  {device.isAvailable ? '✅ 可用' : '❌ 不可用'}
                </div>
              </div>

              {device.model && (
                <div className="device-info">
                  <span className="label">型号:</span> {device.model}
                </div>
              )}

              <div className="device-info">
                <span className="label">电量:</span>
                <div className="battery-bar">
                  <div
                    className={`battery-fill ${getBatteryStatusClass(device.batteryLevel)}`}
                    style={{ width: `${device.batteryLevel}%` }}
                  />
                  <span className="battery-text">{device.batteryLevel}%</span>
                </div>
              </div>

              {device.description && (
                <div className="device-description">{device.description}</div>
              )}

              <div className="device-actions">
                <button
                  className="action-button edit"
                  onClick={() => setEditingDevice(device)}
                >
                  编辑
                </button>
                <button
                  className="action-button delete"
                  onClick={() => handleDelete(device.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
