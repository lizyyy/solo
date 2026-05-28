import { useState } from 'react';
import { X, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Pledge, ExtensionRecord } from '../../types';

interface ExtensionFormProps {
  pledgeId: string;
  pledge: Pledge;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExtensionForm({ pledgeId, pledge, onClose, onSuccess }: ExtensionFormProps) {
  const addExtension = useAppStore((state) => state.addExtension);
  const [formData, setFormData] = useState({
    newEndDate: '',
    newWarningLine: pledge.warningLine.toString(),
    status: 'pending' as ExtensionRecord['status'],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.newEndDate) {
      newErrors.newEndDate = '请选择新到期日';
    } else if (new Date(formData.newEndDate) <= new Date(pledge.endDate)) {
      newErrors.newEndDate = '新到期日必须晚于原到期日';
    }
    const warningLine = parseFloat(formData.newWarningLine);
    if (isNaN(warningLine) || warningLine <= 0 || warningLine >= 100) {
      newErrors.newWarningLine = '警戒线必须在0-100之间';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    addExtension(pledgeId, {
      newEndDate: formData.newEndDate,
      newWarningLine: parseFloat(formData.newWarningLine),
      status: formData.status,
      approveDate: formData.status === 'approved' ? new Date().toISOString().split('T')[0] : undefined,
    });

    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">申请展期</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">原合约信息</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>原到期日：{pledge.endDate}</div>
                <div>原警戒线：{pledge.warningLine.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新到期日
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.newEndDate}
                onChange={(e) => setFormData({ ...formData, newEndDate: e.target.value })}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${
                  errors.newEndDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.newEndDate && (
              <p className="mt-1 text-sm text-red-600">{errors.newEndDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新警戒线 (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.newWarningLine}
              onChange={(e) => setFormData({ ...formData, newWarningLine: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] ${
                errors.newWarningLine ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入新警戒线"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            />
            {errors.newWarningLine && (
              <p className="mt-1 text-sm text-red-600">{errors.newWarningLine}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              审批状态
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="pending"
                  checked={formData.status === 'pending'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ExtensionRecord['status'] })}
                  className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">待审批</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="approved"
                  checked={formData.status === 'approved'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ExtensionRecord['status'] })}
                  className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">已通过</span>
              </label>
            </div>
          </div>

          {formData.status === 'pending' && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 text-orange-800">
                <Clock className="w-4 h-4" />
                <span className="text-sm">系统将标记"展期待批"，审批后警戒线自动生效</span>
              </div>
            </div>
          )}

          {formData.status === 'approved' && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2 text-red-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">注意：展期后仍可能触发预警</div>
                  <div className="mt-1 text-xs text-red-600">
                    如果新警戒线低于当前质押率，系统将识别为"展期后仍触发旧任务"
                  </div>
                </div>
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
              确认申请
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
