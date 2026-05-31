import React, { useState } from 'react';
import { X } from 'lucide-react';
import { RecordStatus } from '../types';
import { getStatusLabel, getStatusColor } from '../utils';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: RecordStatus, reason: string) => void;
  currentStatus?: RecordStatus;
  recordName?: string;
  isBatch?: boolean;
  selectedCount?: number;
}

const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  recordName,
  isBatch = false,
  selectedCount = 0
}) => {
  const [newStatus, setNewStatus] = useState<RecordStatus>('normal');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const statusOptions: { value: RecordStatus; label: string; desc: string }[] = [
    { value: 'normal', label: '正常', desc: '标记为检查通过' },
    { value: 'pending', label: '待处理', desc: '需要进一步确认或处理' },
    { value: 'abnormal', label: '异常', desc: '发现问题需要解决' }
  ];

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(newStatus, reason);
      setReason('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">更新状态</h3>
            {isBatch ? (
              <p className="text-sm text-slate-500">已选择 {selectedCount} 条记录</p>
            ) : (
              <p className="text-sm text-slate-500">{recordName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {currentStatus && !isBatch && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">当前状态</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-md border ${getStatusColor(currentStatus)}`}>
                {getStatusLabel(currentStatus)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              新状态
            </label>
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    newStatus === option.value
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={newStatus === option.value}
                    onChange={() => setNewStatus(option.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{option.label}</p>
                    <p className="text-sm text-slate-500">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              操作原因 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入操作原因，这将被记录到历史中..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认更新
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusUpdateModal;
