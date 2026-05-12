import React, { useState, useEffect } from 'react';
import { Users, Car, Clock, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { Driver, Vehicle, Shift } from '../types';
import { getDrivers, saveDrivers, getVehicles, saveVehicles, getShifts, saveShifts, generateId } from '../store/storage';
import { formatDateTime } from '../utils/format';

type TabType = 'drivers' | 'vehicles' | 'shifts';

const Management: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('drivers');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setDrivers(getDrivers());
    setVehicles(getVehicles());
    setShifts(getShifts());
  };

  const handleSaveDriver = (data: Partial<Driver>) => {
    if (editingItem) {
      const updated = drivers.map((d) =>
        d.id === editingItem.id ? { ...d, ...data } : d
      );
      saveDrivers(updated);
      setDrivers(updated);
    } else {
      const newDriver: Driver = {
        id: generateId(),
        name: data.name || '',
        licenseNumber: data.licenseNumber || '',
        phone: data.phone || '',
        totalPoints: 12,
        remainingPoints: 12,
      };
      const updated = [newDriver, ...drivers];
      saveDrivers(updated);
      setDrivers(updated);
    }
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleSaveVehicle = (data: Partial<Vehicle>) => {
    if (editingItem) {
      const updated = vehicles.map((v) =>
        v.id === editingItem.id ? { ...v, ...data } : v
      );
      saveVehicles(updated);
      setVehicles(updated);
    } else {
      const newVehicle: Vehicle = {
        id: generateId(),
        plateNumber: data.plateNumber || '',
        vehicleType: data.vehicleType || '',
        brand: data.brand || '',
      };
      const updated = [newVehicle, ...vehicles];
      saveVehicles(updated);
      setVehicles(updated);
    }
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleSaveShift = (data: Partial<Shift>) => {
    if (editingItem) {
      const updated = shifts.map((s) =>
        s.id === editingItem.id ? { ...s, ...data } : s
      );
      saveShifts(updated);
      setShifts(updated);
    } else {
      const newShift: Shift = {
        id: generateId(),
        vehicleId: data.vehicleId || '',
        driverId: data.driverId || '',
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        notes: data.notes || '',
      };
      const updated = [newShift, ...shifts];
      saveShifts(updated);
      setShifts(updated);
    }
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定要删除吗？')) return;

    if (activeTab === 'drivers') {
      const updated = drivers.filter((d) => d.id !== id);
      saveDrivers(updated);
      setDrivers(updated);
    } else if (activeTab === 'vehicles') {
      const updated = vehicles.filter((v) => v.id !== id);
      saveVehicles(updated);
      setVehicles(updated);
    } else {
      const updated = shifts.filter((s) => s.id !== id);
      saveShifts(updated);
      setShifts(updated);
    }
  };

  const Modal = () => {
    const [formData, setFormData] = useState<Record<string, string>>(
      editingItem || {}
    );

    const handleSubmit = () => {
      if (activeTab === 'drivers') {
        handleSaveDriver(formData);
      } else if (activeTab === 'vehicles') {
        handleSaveVehicle(formData);
      } else {
        handleSaveShift(formData);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">
              {editingItem ? '编辑' : '添加'}
              {activeTab === 'drivers' ? '司机' : activeTab === 'vehicles' ? '车辆' : '班次'}
            </h2>
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingItem(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {activeTab === 'drivers' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">驾照编号</label>
                  <input
                    type="text"
                    value={formData.licenseNumber || ''}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {activeTab === 'vehicles' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">车牌号</label>
                  <input
                    type="text"
                    value={formData.plateNumber || ''}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">车辆类型</label>
                  <select
                    value={formData.vehicleType || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">请选择</option>
                    <option value="货车">货车</option>
                    <option value="客车">客车</option>
                    <option value="轿车">轿车</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {activeTab === 'shifts' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">车辆</label>
                  <select
                    value={formData.vehicleId || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">请选择车辆</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.plateNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">司机</label>
                  <select
                    value={formData.driverId || ''}
                    onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">请选择司机</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                    <input
                      type="datetime-local"
                      value={formData.startTime?.slice(0, 16) || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                    <input
                      type="datetime-local"
                      value={formData.endTime?.slice(0, 16) || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="如：白班、夜班、长途等"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 bg-white rounded-lg p-1 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'drivers'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>司机管理</span>
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'vehicles'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>车辆管理</span>
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            activeTab === 'shifts'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>班次管理</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            {activeTab === 'drivers' ? '司机列表' : activeTab === 'vehicles' ? '车辆列表' : '班次列表'}
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>添加</span>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'drivers' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">驾照编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系电话</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总分</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">剩余分数</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{driver.name[0]}</span>
                          </div>
                          <span className="font-medium text-gray-900">{driver.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{driver.licenseNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{driver.phone}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{driver.totalPoints}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          driver.remainingPoints >= 9 ? 'bg-green-100 text-green-800' :
                          driver.remainingPoints >= 6 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {driver.remainingPoints}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setEditingItem(driver);
                            setShowAddModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(driver.id)}
                          className="text-red-600 hover:text-red-800 p-1 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">车牌号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">车辆类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品牌</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{vehicle.plateNumber}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{vehicle.vehicleType}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{vehicle.brand}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setEditingItem(vehicle);
                            setShowAddModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="text-red-600 hover:text-red-800 p-1 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'shifts' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">车辆</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">司机</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开始时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结束时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shifts.map((shift) => {
                    const vehicle = vehicles.find((v) => v.id === shift.vehicleId);
                    const driver = drivers.find((d) => d.id === shift.driverId);
                    return (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {vehicle?.plateNumber || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {driver?.name || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(shift.startTime)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(shift.endTime)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {shift.notes || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => {
                              setEditingItem(shift);
                              setShowAddModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(shift.id)}
                            className="text-red-600 hover:text-red-800 p-1 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && <Modal />}
    </div>
  );
};

export default Management;
