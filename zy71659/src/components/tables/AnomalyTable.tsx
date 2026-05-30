import React, { useState } from 'react';
import { Eye, Check, X, Wrench, MessageSquare } from 'lucide-react';
import { Anomaly, AnomalyStatus } from '@/types/anomalies';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime, formatDuration } from '@/utils/formatters';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/common/Modal';
import { confirmAnomaly, dismissAnomaly, resolveAnomaly } from '@/services/anomalyService';

interface AnomalyTableProps {
  anomalies: Anomaly[];
  onViewDetail?: (anomaly: Anomaly) => void;
}

export const AnomalyTable: React.FC<AnomalyTableProps> = ({ anomalies, onViewDetail }) => {
  const { selectedAnomalyId, highlightAnomaly, currentUser, setAnomalies } = useAppStore();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [actionType, setActionType] = useState<'confirm' | 'dismiss' | 'resolve'>('confirm');
  const [note, setNote] = useState('');

  const handleAction = async (anomaly: Anomaly, action: 'confirm' | 'dismiss' | 'resolve') => {
    setSelectedAnomaly(anomaly);
    setActionType(action);
    setNote('');
    setConfirmModalOpen(true);
  };

  const executeAction = async () => {
    if (!selectedAnomaly) return;

    try {
      let updated: Anomaly | undefined;
      
      switch (actionType) {
        case 'confirm':
          updated = await confirmAnomaly(selectedAnomaly.id!, currentUser, note);
          break;
        case 'dismiss':
          updated = await dismissAnomaly(selectedAnomaly.id!, currentUser, note);
          break;
        case 'resolve':
          updated = await resolveAnomaly(selectedAnomaly.id!, currentUser, note);
          break;
      }

      if (updated) {
        const updatedList = anomalies.map(a => a.id === updated!.id ? updated! : a);
        setAnomalies(updatedList);
      }

      setConfirmModalOpen(false);
      setSelectedAnomaly(null);
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const getActionButtons = (anomaly: Anomaly) => {
    const buttons: React.ReactNode[] = [];

    if (anomaly.status === 'detected') {
      buttons.push(
        <button
          key="confirm"
          className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleAction(anomaly, 'confirm');
          }}
          title="确认异常"
        >
          <Check size={14} />
        </button>
      );
      buttons.push(
        <button
          key="dismiss"
          className="p-1 text-slate-400 hover:text-slate-300 transition-colors ml-1"
          onClick={(e) => {
            e.stopPropagation();
            handleAction(anomaly, 'dismiss');
          }}
          title="标记误报"
        >
          <X size={14} />
        </button>
      );
    }

    if (anomaly.status === 'confirmed') {
      buttons.push(
        <button
          key="resolve"
          className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleAction(anomaly, 'resolve');
          }}
          title="标记已解决"
        >
          <Wrench size={14} />
        </button>
      );
    }

    return buttons;
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="text-sm font-medium text-slate-200">异常事件列表</span>
          <span className="text-xs text-slate-500">共 {anomalies.length} 条异常</span>
        </div>
        <div className="overflow-x-auto max-h-96 scrollbar-thin">
          <table className="w-full">
            <thead className="table-header sticky top-0">
              <tr>
                <th className="table-cell text-left">类型</th>
                <th className="table-cell text-left">严重程度</th>
                <th className="table-cell text-left">状态</th>
                <th className="table-cell text-left">检测时间</th>
                <th className="table-cell text-left">描述</th>
                <th className="table-cell text-left">影响采样数</th>
                <th className="table-cell text-left">处理人</th>
                <th className="table-cell text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((anomaly) => (
                <tr
                  key={anomaly.id}
                  className={cn(
                    'transition-colors hover:bg-slate-700/30 cursor-pointer',
                    selectedAnomalyId === anomaly.id && 'bg-red-500/10 border-l-2 border-l-red-500'
                  )}
                  onClick={() => highlightAnomaly(anomaly.id)}
                >
                  <td className="table-cell">
                    <StatusBadge type="anomalyType" value={anomaly.type} />
                  </td>
                  <td className="table-cell">
                    <StatusBadge type="severity" value={anomaly.severity} />
                  </td>
                  <td className="table-cell">
                    <StatusBadge type="status" value={anomaly.status} />
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-300">
                    {formatTime(anomaly.detectedAt)}
                  </td>
                  <td className="table-cell text-xs text-slate-300 max-w-xs truncate">
                    {anomaly.description}
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-400">
                    {anomaly.affectedSampleIds.length}
                  </td>
                  <td className="table-cell text-xs text-slate-400">
                    {anomaly.confirmedBy || '-'}
                  </td>
                  <td className="table-cell text-right">
                    <button
                      className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDetail?.(anomaly);
                      }}
                      title="查看详情"
                    >
                      <Eye size={14} />
                    </button>
                    {getActionButtons(anomaly)}
                    <button
                      className="p-1 text-slate-400 hover:text-amber-400 transition-colors ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        highlightAnomaly(anomaly.id);
                      }}
                      title="在图表中定位"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title={actionType === 'confirm' ? '确认异常' : actionType === 'dismiss' ? '标记误报' : '标记已解决'}
        size="sm"
      >
        <div className="space-y-4">
          {selectedAnomaly && (
            <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge type="anomalyType" value={selectedAnomaly.type} />
                <StatusBadge type="severity" value={selectedAnomaly.severity} />
              </div>
              <p className="text-sm text-slate-300">{selectedAnomaly.description}</p>
            </div>
          )}
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">处理备注</label>
            <textarea
              className="input w-full h-24 resize-none"
              placeholder="请输入处理备注..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmModalOpen(false)}
            >
              取消
            </button>
            <button
              className={cn(
                'btn',
                actionType === 'confirm' && 'btn-primary',
                actionType === 'dismiss' && 'btn-secondary',
                actionType === 'resolve' && 'btn-success'
              )}
              onClick={executeAction}
            >
              {actionType === 'confirm' ? '确认异常' : actionType === 'dismiss' ? '标记误报' : '标记已解决'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
