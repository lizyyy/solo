import { useState } from 'react';
import { Undo2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { useSettlementStore } from '../store/useSettlementStore';
import type { SettlementStatus } from '../types';
import { STATUS_LABELS } from '../types';

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlementId: string;
  currentStatus: SettlementStatus;
}

const allowedTargets: SettlementStatus[] = ['pending', 'need_material'];

export default function RollbackModal({
  isOpen,
  onClose,
  settlementId,
  currentStatus,
}: RollbackModalProps) {
  const [targetStatus, setTargetStatus] = useState<SettlementStatus>('pending');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const rollback = useSettlementStore(state => state.rollback);

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert('请填写回退原因');
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    rollback(settlementId, reason, targetStatus);
    onClose();
  };

  const handleClose = () => {
    setTargetStatus('pending');
    setReason('');
    setConfirming(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="回退操作"
      size="md"
    >
      <div className="space-y-5">
        <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg flex items-start gap-3">
          <Undo2 className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning-800">
              当前状态：{STATUS_LABELS[currentStatus]}
            </p>
            <p className="text-xs text-warning-600 mt-1">
              回退操作将撤销当前处理结果，需要重新走审核流程
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            回退到状态
          </label>
          <div className="space-y-2">
            {allowedTargets.map(status => (
              <label
                key={status}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                  targetStatus === status
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="targetStatus"
                  value={status}
                  checked={targetStatus === status}
                  onChange={() => setTargetStatus(status)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    targetStatus === status
                      ? 'border-primary-500'
                      : 'border-neutral-300'
                  }`}
                >
                  {targetStatus === status && (
                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    targetStatus === status
                      ? 'text-primary-700 font-medium'
                      : 'text-neutral-700'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            回退原因 <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            className="textarea"
            placeholder="请详细说明回退原因，如：数据有误、需重新核对、材料补充后重审等"
          />
        </div>

        {confirming && (
          <div className="p-4 bg-danger-50 border border-danger-300 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-danger-800 font-medium">
                  二次确认：确定要回退吗？
                </p>
                <p className="text-xs text-danger-600 mt-1">
                  将从「{STATUS_LABELS[currentStatus]}」回退到「{STATUS_LABELS[targetStatus]}」
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
          <button className="btn" onClick={handleClose}>
            取消
          </button>
          <button
            className={`btn ${confirming ? 'btn-danger' : 'btn-warning'}`}
            onClick={handleSubmit}
            disabled={!reason.trim()}
          >
            {confirming ? '确认回退' : '下一步'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
