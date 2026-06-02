import { X, AlertTriangle, Check, XCircle, Edit3 } from 'lucide-react';
import { useAllocationStore } from '@/store/useAllocationStore';
import type { ConflictItem } from '@/types';
import { groupConflictsByRecord } from '@/utils/conflictDetection';

const FIELD_LABELS: Record<string, string> = {
  roomType: '房型',
  checkInDate: '入住日期',
  checkOutDate: '退房日期',
  hotelName: '酒店名称',
};

interface ConflictModalProps {
  isOpen: boolean;
  conflicts: ConflictItem[];
  versionId: string;
  onClose: () => void;
}

export const ConflictModal = ({ isOpen, conflicts, versionId, onClose }: ConflictModalProps) => {
  const applyConflictResolution = useAllocationStore(state => state.applyConflictResolution);
  const finalizeImport = useAllocationStore(state => state.finalizeImport);
  const cancelImport = useAllocationStore(state => state.cancelImport);
  const allocations = useAllocationStore(state => state.allocations);

  const groupedConflicts = groupConflictsByRecord(conflicts);
  const remainingCount = conflicts.length;

  const handleResolve = (
    recordId: string,
    fieldName: string,
    choice: 'keep' | 'adopt',
    conflict: ConflictItem
  ) => {
    applyConflictResolution(recordId, fieldName, choice);
  };

  const handleFinalize = () => {
    finalizeImport(versionId);
    onClose();
  };

  const handleCancel = () => {
    cancelImport();
    onClose();
  };

  if (!isOpen || conflicts.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={handleCancel} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl z-50 animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-accent-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-gray-800">
                发现数据冲突
              </h3>
              <p className="text-sm text-gray-500">
                还有 <span className="font-semibold text-accent-600">{remainingCount}</span> 处冲突需要处理
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ 导入的新版本数据与现有数据有不一致的地方，我不会自动替你决定。
              请逐条核对，选择保留旧版还是采用新版数据。
            </p>
          </div>

          {Array.from(groupedConflicts.entries()).map(([recordId, recordConflicts]) => {
            const record = allocations.find(a => a.id === recordId);
            if (!record) return null;

            return (
              <div key={recordId} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-800">
                        {record.personName || '（未填姓名）'}
                      </span>
                      <span className="text-gray-400 mx-2">·</span>
                      <span className="text-sm text-gray-500">
                        {record.hotelName} · {record.tourName}
                      </span>
                    </div>
                    <span className="badge bg-red-100 text-red-700">
                      {recordConflicts.length} 处冲突
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {recordConflicts.map(conflict => (
                    <div key={`${conflict.recordId}-${conflict.fieldName}`} className="p-4">
                      <p className="text-sm text-gray-600 mb-3">
                        {conflict.suggestion}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          true ? 'border-primary-200 bg-primary-50' : 'border-gray-200'
                        }`}>
                          <div className="text-xs text-gray-500 mb-2">
                            现有数据 · {conflict.oldSource}
                          </div>
                          <div className="text-lg font-semibold text-gray-800">
                            {conflict.oldValue || '（空）'}
                          </div>
                          <button
                            onClick={() => handleResolve(recordId, conflict.fieldName, 'keep', conflict)}
                            className="mt-3 w-full btn-secondary text-sm py-1.5"
                          >
                            <XCircle className="w-4 h-4 inline mr-1" />
                            保留这版
                          </button>
                        </div>

                        <div className="flex items-center justify-center h-full py-4">
                          <Edit3 className="w-5 h-5 text-gray-300" />
                        </div>

                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          true ? 'border-accent-200 bg-accent-50' : 'border-gray-200'
                        }`}>
                          <div className="text-xs text-gray-500 mb-2">
                            新导入 · {conflict.newSource}
                          </div>
                          <div className="text-lg font-semibold text-gray-800">
                            {conflict.newValue || '（空）'}
                          </div>
                          <button
                            onClick={() => handleResolve(recordId, conflict.fieldName, 'adopt', conflict)}
                            className="mt-3 w-full btn-primary text-sm py-1.5"
                          >
                            <Check className="w-4 h-4 inline mr-1" />
                            采用新版
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={handleCancel}
            className="btn-secondary flex-1"
          >
            取消导入
          </button>
          <button
            onClick={handleFinalize}
            disabled={remainingCount > 0}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {remainingCount === 0 ? '全部处理完成，确认导入' : `还有 ${remainingCount} 处冲突`}
          </button>
        </div>
      </div>
    </>
  );
};
