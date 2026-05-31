import { Clock, Plus, Pencil, Trash2, Upload, Download, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '@/store/useAppStore';
import { formatAction, getActionColor, getTargetTypeLabel } from '@/services/historyService';
import { formatDateTime } from '@/utils/timeUtils';
import type { HistoryAction } from '@/types';

export function HistoryModal() {
  const isOpen = useAppStore(state => state.isHistoryModalOpen);
  const closeModal = useAppStore(state => state.closeHistoryModal);
  const history = useAppStore(state => state.history);

  const getActionIcon = (action: HistoryAction) => {
    const icons = {
      CREATE: Plus,
      UPDATE: Pencil,
      DELETE: Trash2,
      IMPORT: Upload,
      EXPORT: Download,
      RESOLVE: CheckCircle
    };
    return icons[action];
  };

  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="操作历史">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock size={14} />
          <span>共 {history.length} 条记录</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock size={48} className="mx-auto mb-3 opacity-30" />
            <p>暂无操作记录</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedHistory.map((record, index) => {
              const ActionIcon = getActionIcon(record.action);
              return (
                <div
                  key={record.id}
                  className="p-3 bg-space-800 rounded border border-tech-cyan/10 hover:border-tech-cyan/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded ${getActionColor(record.action).replace('text-', 'bg-').replace('tech-', 'tech-')}/10`}>
                      <ActionIcon size={14} className={getActionColor(record.action)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm ${getActionColor(record.action)}`}>
                          {formatAction(record.action)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getTargetTypeLabel(record.targetType)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1">
                        {record.remark}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {formatDateTime(record.timestamp)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">{record.operator}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-4 border-t border-tech-cyan/20">
          <button
            onClick={closeModal}
            className="w-full btn-tech"
          >
            关闭
          </button>
        </div>
      </div>
    </Modal>
  );
}
