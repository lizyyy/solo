import React, { useState } from 'react';
import { Check, X, Copy, RotateCcw } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { RecordStatus } from '@/types';

const BatchActions: React.FC = () => {
  const selectedIds = useRecordStore((state) => state.selectedIds);
  const batchUpdateStatus = useRecordStore((state) => state.batchUpdateStatus);
  const clearSelection = useRecordStore((state) => state.clearSelection);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<RecordStatus | null>(null);
  const [reason, setReason] = useState('');

  const actions: { type: RecordStatus; label: string; icon: React.ElementType; color: string }[] = [
    { type: 'approved', label: '批量通过', icon: Check, color: 'bg-green-600 hover:bg-green-700' },
    { type: 'rejected', label: '批量驳回', icon: X, color: 'bg-red-600 hover:bg-red-700' },
    { type: 'duplicate', label: '标记重复', icon: Copy, color: 'bg-gray-600 hover:bg-gray-700' },
    { type: 'pending', label: '退回待处理', icon: RotateCcw, color: 'bg-orange-600 hover:bg-orange-700' },
  ];

  const handleAction = (type: RecordStatus) => {
    setActionType(type);
    setShowModal(true);
    setReason('');
  };

  const confirmAction = () => {
    if (actionType && reason.trim()) {
      batchUpdateStatus(Array.from(selectedIds), actionType, reason);
      setShowModal(false);
      setActionType(null);
      setReason('');
    }
  };

  if (selectedIds.size === 0) return null;

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-blue-700">
          已选择 <strong>{selectedIds.size}</strong> 条记录
        </span>
        <div className="flex items-center gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.type}
                onClick={() => handleAction(action.type)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm text-white transition-colors ${action.color}`}
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            取消选择
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">确认批量操作</h3>
            <p className="text-sm text-gray-600 mb-4">
              将对 <strong>{selectedIds.size}</strong> 条记录执行操作，请填写操作原因：
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入操作原因..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmAction}
                disabled={!reason.trim()}
                className="px-4 py-2 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BatchActions;
