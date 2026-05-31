import { useState } from 'react';
import { RecordStatus } from '@/types';
import { statusLabels } from '@/utils/statusUtils';
import { useRecordStore } from '@/store/useRecordStore';

interface StatusFormProps {
  recordId: string;
  currentStatus: RecordStatus;
  onClose?: () => void;
}

export function StatusForm({ recordId, currentStatus, onClose }: StatusFormProps) {
  const [newStatus, setNewStatus] = useState<RecordStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const updateRecordStatus = useRecordStore((state) => state.updateRecordStatus);

  const statusOptions: { value: RecordStatus; label: string; color: string }[] = [
    { value: 'pending', label: statusLabels.pending, color: 'bg-amber-100 text-amber-700' },
    { value: 'confirmed', label: statusLabels.confirmed, color: 'bg-green-100 text-green-700' },
    { value: 'to_supplement', label: statusLabels.to_supplement, color: 'bg-red-100 text-red-700' },
    { value: 'modified', label: statusLabels.modified, color: 'bg-blue-100 text-blue-700' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('请填写变更原因');
      return;
    }
    updateRecordStatus(recordId, newStatus, reason, remark || undefined);
    onClose?.();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">变更状态</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            目标状态
          </label>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setNewStatus(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  newStatus === option.value
                    ? `${option.color} ring-2 ring-offset-2 ring-slate-400`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            变更原因 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="请详细说明状态变更的原因..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            备注（可选）
          </label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="补充说明..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            确认变更
          </button>
        </div>
      </div>
    </form>
  );
}
