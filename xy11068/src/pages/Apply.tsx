import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReturnStore } from '../store/returnStore';
import { DeviceItem, DeviceType, BatteryStatus, DeviceCondition, DeviceTypeLabels, BatteryStatusLabels, DeviceConditionLabels } from '../../shared/types';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

export default function Apply() {
  const navigate = useNavigate();
  const { createApplication, loading } = useReturnStore();

  const [formData, setFormData] = useState({
    teamName: '',
    responsiblePerson: '',
    phone: '',
    returnDate: new Date().toISOString().split('T')[0],
    submitSource: 'web' as const,
    operator: ''
  });

  const [devices, setDevices] = useState<DeviceItem[]>([
    {
      deviceId: '',
      deviceType: 'adult' as DeviceType,
      batteryStatus: 'full' as BatteryStatus,
      borrowDate: new Date().toISOString().split('T')[0],
      borrowTeam: '',
      condition: 'normal' as DeviceCondition,
      remarks: ''
    }
  ]);

  const addDevice = () => {
    setDevices([
      ...devices,
      {
        deviceId: '',
        deviceType: 'adult' as DeviceType,
        batteryStatus: 'full' as BatteryStatus,
        borrowDate: new Date().toISOString().split('T')[0],
        borrowTeam: formData.teamName,
        condition: 'normal' as DeviceCondition,
        remarks: ''
      }
    ]);
  };

  const removeDevice = (index: number) => {
    if (devices.length > 1) {
      setDevices(devices.filter((_, i) => i !== index));
    }
  };

  const updateDevice = (index: number, field: keyof DeviceItem, value: string) => {
    const updated = [...devices];
    (updated[index] as any)[field] = value;
    setDevices(updated);
  };

  const handleSubmit = async () => {
    if (!formData.teamName || !formData.responsiblePerson || !formData.phone) {
      alert('请填写完整的基本信息');
      return;
    }

    const invalidDevices = devices.filter(d => !d.deviceId);
    if (invalidDevices.length > 0) {
      alert('请填写所有设备的设备编号');
      return;
    }

    const result = await createApplication({
      ...formData,
      deviceCount: devices.length,
      devices
    });

    if (result) {
      alert('创建成功');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-6 px-6">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-200 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <h1 className="text-2xl font-bold">新建讲解器归还申请</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">基本信息</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">讲解组名称 *</label>
              <input
                type="text"
                value={formData.teamName}
                onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                placeholder="如：青铜器展厅讲解一组"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">负责人姓名 *</label>
              <input
                type="text"
                value={formData.responsiblePerson}
                onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                placeholder="请输入负责人姓名"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">联系电话 *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入联系电话"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">归还日期</label>
              <input
                type="date"
                value={formData.returnDate}
                onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">提交来源</label>
              <select
                value={formData.submitSource}
                onChange={(e) => setFormData({ ...formData, submitSource: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="web">Web端</option>
                <option value="miniapp">小程序</option>
                <option value="backend">后台录入</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">操作人</label>
              <input
                type="text"
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                placeholder="请输入操作人姓名"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">设备清单</h2>
            <button
              onClick={addDevice}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加设备
            </button>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {devices.map((device, index) => (
                <div key={index} className="p-6 border border-gray-200 rounded-xl relative">
                  {devices.length > 1 && (
                    <button
                      onClick={() => removeDevice(index)}
                      className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <h3 className="font-medium text-gray-800 mb-4">设备 {index + 1}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">设备编号</label>
                      <input
                        type="text"
                        value={device.deviceId}
                        onChange={(e) => updateDevice(index, 'deviceId', e.target.value)}
                        placeholder="如：DJQ-001-A"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">设备类型</label>
                      <select
                        value={device.deviceType}
                        onChange={(e) => updateDevice(index, 'deviceType', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {Object.entries(DeviceTypeLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">电量状态</label>
                      <select
                        value={device.batteryStatus}
                        onChange={(e) => updateDevice(index, 'batteryStatus', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {Object.entries(BatteryStatusLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">借出日期</label>
                      <input
                        type="date"
                        value={device.borrowDate}
                        onChange={(e) => updateDevice(index, 'borrowDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">借出团队</label>
                      <input
                        type="text"
                        value={device.borrowTeam}
                        onChange={(e) => updateDevice(index, 'borrowTeam', e.target.value)}
                        placeholder="默认与归还团队一致"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">设备状态</label>
                      <select
                        value={device.condition}
                        onChange={(e) => updateDevice(index, 'condition', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {Object.entries(DeviceConditionLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
                      <input
                        type="text"
                        value={device.remarks}
                        onChange={(e) => updateDevice(index, 'remarks', e.target.value)}
                        placeholder="设备问题描述等"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '提交中...' : '提交申请'}
          </button>
        </div>
      </div>
    </div>
  );
}
