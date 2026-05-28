import { useState } from 'react';
import { X, FileText, AlertTriangle, Send } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { DisposalStatus } from '../../types';

interface DisposalFormProps {
  pledgeId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DisposalForm({ pledgeId, onClose, onSuccess }: DisposalFormProps) {
  const addDisposal = useAppStore((state) => state.addDisposal);
  const [formData, setFormData] = useState({
    reportContent: '',
    status: 'draft' as DisposalStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.reportContent.trim()) {
      newErrors.reportContent = '请填写处置报告内容';
    } else if (formData.reportContent.trim().length < 10) {
      newErrors.reportContent = '报告内容不少于10个字';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    addDisposal(pledgeId, {
      reportContent: formData.reportContent.trim(),
      status: formData.status,
    });

    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">提交处置报告</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium">平仓处置操作留痕</div>
                <div className="mt-1 text-xs text-red-600">
                  处置报告将永久保存，作为风控操作历史记录
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              处置报告内容
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={formData.reportContent}
                onChange={(e) => setFormData({ ...formData, reportContent: e.target.value })}
                rows={6}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none ${
                  errors.reportContent ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请详细描述处置方案、预计处置时间、预计处置金额等信息..."
              />
            </div>
            {errors.reportContent && (
              <p className="mt-1 text-sm text-red-600">{errors.reportContent}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              已输入 {formData.reportContent.length} 字
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              报告状态
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={formData.status === 'draft'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as DisposalStatus })}
                  className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">保存草稿</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="submitted"
                  checked={formData.status === 'submitted'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as DisposalStatus })}
                  className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">正式提交</span>
              </label>
            </div>
          </div>

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
              className="flex-1 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-[#dc2626]/90 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {formData.status === 'draft' ? '保存草稿' : '提交报告'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
