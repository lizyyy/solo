import React, { useState } from 'react';
import { X, Phone, Smartphone, Wrench, DollarSign, Clock, User } from 'lucide-react';
import type { Technician, OrderStatus } from '../types';
import { STATUS_LABELS } from '../constants/statusFlow';

interface CreateOrderFormProps {
  technicians: Technician[];
  onSubmit: (data: {
    customer_name: string;
    customer_phone: string;
    device_brand: string;
    device_model: string;
    device_imei?: string;
    technician_id?: number;
    fault_description: string;
    quote?: number;
    estimated_completion_time?: string;
    status: OrderStatus;
  }) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function CreateOrderForm({ technicians, onSubmit, onClose, isLoading }: CreateOrderFormProps) {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    device_brand: '',
    device_model: '',
    device_imei: '',
    technician_id: '',
    fault_description: '',
    quote: '',
    estimated_completion_time: '',
    status: '待检测' as OrderStatus
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = '请输入客户姓名';
    }

    if (!formData.customer_phone.trim()) {
      newErrors.customer_phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(formData.customer_phone)) {
      newErrors.customer_phone = '手机号格式不正确';
    }

    if (!formData.device_brand.trim()) {
      newErrors.device_brand = '请输入设备品牌';
    }

    if (!formData.device_model.trim()) {
      newErrors.device_model = '请输入设备型号';
    }

    if (!formData.fault_description.trim()) {
      newErrors.fault_description = '请输入故障描述';
    }

    if (formData.estimated_completion_time) {
      const now = new Date();
      const estimated = new Date(formData.estimated_completion_time);
      if (estimated <= now) {
        newErrors.estimated_completion_time = '预计完成时间不能早于当前时间';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSubmit({
      customer_name: formData.customer_name.trim(),
      customer_phone: formData.customer_phone.trim(),
      device_brand: formData.device_brand.trim(),
      device_model: formData.device_model.trim(),
      device_imei: formData.device_imei.trim() || undefined,
      technician_id: formData.technician_id ? parseInt(formData.technician_id) : undefined,
      fault_description: formData.fault_description.trim(),
      quote: formData.quote ? parseFloat(formData.quote) : undefined,
      estimated_completion_time: formData.estimated_completion_time || undefined,
      status: formData.status
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="drawer-overlay" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">新建工单</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">客户信息</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4" />
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  className={`input-field ${errors.customer_name ? 'border-red-300 focus:ring-red-500' : ''}`}
                  placeholder="请输入客户姓名"
                />
                {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4" />
                  手机号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => handleChange('customer_phone', e.target.value)}
                  className={`input-field ${errors.customer_phone ? 'border-red-300 focus:ring-red-500' : ''}`}
                  placeholder="请输入手机号"
                />
                {errors.customer_phone && <p className="text-red-500 text-xs mt-1">{errors.customer_phone}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">设备信息</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Smartphone className="w-4 h-4" />
                  品牌 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.device_brand}
                  onChange={(e) => handleChange('device_brand', e.target.value)}
                  className={`input-field ${errors.device_brand ? 'border-red-300 focus:ring-red-500' : ''}`}
                  placeholder="如：iPhone、华为、小米"
                />
                {errors.device_brand && <p className="text-red-500 text-xs mt-1">{errors.device_brand}</p>}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  型号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.device_model}
                  onChange={(e) => handleChange('device_model', e.target.value)}
                  className={`input-field ${errors.device_model ? 'border-red-300 focus:ring-red-500' : ''}`}
                  placeholder="如：15 Pro、Mate 60"
                />
                {errors.device_model && <p className="text-red-500 text-xs mt-1">{errors.device_model}</p>}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                IMEI
              </label>
              <input
                type="text"
                value={formData.device_imei}
                onChange={(e) => handleChange('device_imei', e.target.value)}
                className="input-field"
                placeholder="设备序列号（选填）"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">工单信息</h3>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Wrench className="w-4 h-4" />
                故障描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.fault_description}
                onChange={(e) => handleChange('fault_description', e.target.value)}
                rows={3}
                className={`input-field resize-none ${errors.fault_description ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="详细描述故障情况，如：换屏、换电池、不开机等"
              />
              {errors.fault_description && <p className="text-red-500 text-xs mt-1">{errors.fault_description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <DollarSign className="w-4 h-4" />
                  报价 (元)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quote}
                  onChange={(e) => handleChange('quote', e.target.value)}
                  className="input-field"
                  placeholder="选填"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4" />
                  预计完成时间
                </label>
                <input
                  type="datetime-local"
                  value={formData.estimated_completion_time}
                  onChange={(e) => handleChange('estimated_completion_time', e.target.value)}
                  className={`input-field ${errors.estimated_completion_time ? 'border-red-300 focus:ring-red-500' : ''}`}
                />
                {errors.estimated_completion_time && <p className="text-red-500 text-xs mt-1">{errors.estimated_completion_time}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  维修师傅
                </label>
                <select
                  value={formData.technician_id}
                  onChange={(e) => handleChange('technician_id', e.target.value)}
                  className="select-field"
                >
                  <option value="">暂不分配</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  初始状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value as OrderStatus)}
                  className="select-field"
                >
                  {STATUS_LABELS.slice(0, 4).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? '创建中...' : '创建工单'}
          </button>
        </div>
      </div>
    </div>
  );
}
