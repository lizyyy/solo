import { useState } from 'react';
import { X } from 'lucide-react';
import type { RedemptionStatus } from '@/types';
import { STATUS_LABELS } from '@/data/constants';

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: RedemptionStatus, reason: string) => void;
  currentStatus: RedemptionStatus;
  targetStatus: RedemptionStatus;
  title: string;
}

export default function StatusChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  targetStatus,
  title,
}: StatusChangeModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('请填写改判原因');
      return;
    }
    onConfirm(targetStatus, reason);
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-primary-700">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 p-3 rounded text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">当前状态：</span>
              <span className="font-medium">{STATUS_LABELS[currentStatus]}</span>
              <span className="text-gray-300">→</span>
              <span className="text-gray-500">目标状态：</span>
              <span className="font-medium text-primary-600">{STATUS_LABELS[targetStatus]}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              改判原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请详细说明改判原因，如：材料已补齐、与渠道确认金额无误等"
              className="textarea-field h-24"
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button onClick={handleConfirm} className="btn-primary">
            确认改判
          </button>
        </div>
      </div>
    </div>
  );
}
