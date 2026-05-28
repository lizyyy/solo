import { useState } from 'react';
import { X, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { SupplementRecord } from '../../types';

interface SupplementFormProps {
  pledgeId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SupplementForm({ pledgeId, onClose, onSuccess }: SupplementFormProps) {
  const addSupplement = useAppStore((state) => state.addSupplement);
  const [formData, setFormData] = useState({
    amount: '',
    expectedDate: new Date().toISOString().split('T')[0],
    status: 'pending' as SupplementRecord['status'],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = '请输入有效的补仓金额';
    }
    if (!formData.expectedDate) {
      newErrors.expectedDate = '请选择预计到账日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    addSupplement(pledgeId, {
      amount: parseFloat(formData.amount),
      expectedDate: formData.expectedDate,
      status: formData.status,
      actualDate: formData.status === 'received' ? formData.expectedDate : undefined,
    });

    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">登记补仓</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              补仓金额 (元)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入补仓金额"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              预计到账日期
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${
                  errors.expectedDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.expectedDate && (
              <p className="mt-1 text-sm text-red-600">{errors.expectedDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              到账状态
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="pending"
                  checked={formData.status === 'pending'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as SupplementRecord['status'] })}
                  className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">未到账</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="received"
                  checked={formData.status === 'received'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as SupplementRecord['status'] })}
                  className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">已到账</span>
              </label>
            </div>
          </div>

          {formData.status === 'received' && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">补仓将立即抵扣本金，重新计算质押率</span>
              </div>
            </div>
          )}

          {formData.status === 'pending' && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 text-orange-800">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">系统将自动标记"补仓未到账"，到账后请更新状态</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors"
            >
              确认登记
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
