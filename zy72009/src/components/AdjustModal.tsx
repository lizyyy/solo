import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { useSettlementStore } from '../store/useSettlementStore';
import { formatCurrency } from '../utils/amount';

interface AdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlementId: string;
  currentAmount: number;
}

export default function AdjustModal({
  isOpen,
  onClose,
  settlementId,
  currentAmount,
}: AdjustModalProps) {
  const [newAmount, setNewAmount] = useState<string>(currentAmount.toString());
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const manualAdjust = useSettlementStore(state => state.manualAdjust);

  const numAmount = parseFloat(newAmount) || 0;
  const diff = numAmount - currentAmount;

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert('请填写改判原因');
      return;
    }
    if (numAmount <= 0) {
      alert('调整后的金额必须大于0');
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    manualAdjust(settlementId, numAmount, reason);
    onClose();
  };

  const handleClose = () => {
    setNewAmount(currentAmount.toString());
    setReason('');
    setConfirming(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="人工改判"
      size="md"
    >
      <div className="space-y-5">
        <div className="p-4 bg-adjust-50 border border-adjust-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-adjust-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-adjust-800">改判操作将永久记录</p>
            <p className="text-xs text-adjust-600 mt-1">
              改判原因和调整金额都会保存到操作日志，财务主管可在导出时查看
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              当前清分金额
            </label>
            <div className="px-3 py-2 bg-neutral-100 border border-neutral-200 text-sm font-mono text-neutral-600">
              {formatCurrency(currentAmount)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              调整后金额
            </label>
            <input
              type="number"
              step="0.01"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="input font-mono"
              placeholder="请输入调整后金额"
            />
          </div>
        </div>

        {diff !== 0 && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${
              diff > 0
                ? 'bg-success-50 text-success-700 border border-success-200'
                : 'bg-danger-50 text-danger-700 border border-danger-200'
            }`}
          >
            差额：{diff > 0 ? '+' : ''}
            {formatCurrency(diff)}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            改判原因 <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            className="textarea"
            placeholder="请详细说明改判原因，如：金额差异原因、审批依据、涉及口径等"
          />
          <p className="text-xs text-neutral-500 mt-1">
            建议说明：原始数据问题、政策依据、审批人意见等，便于后续追溯
          </p>
        </div>

        {confirming && (
          <div className="p-4 bg-warning-50 border border-warning-300 rounded-lg">
            <p className="text-sm text-warning-800 font-medium">
              ⚠️ 二次确认：确定要执行人工改判吗？
            </p>
            <p className="text-xs text-warning-600 mt-1">
              此操作将记录操作日志，状态变更为"人工改判"
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
          <button className="btn" onClick={handleClose}>
            取消
          </button>
          <button
            className={`btn ${confirming ? 'btn-adjust' : 'btn-primary'}`}
            onClick={handleSubmit}
            disabled={!reason.trim()}
          >
            {confirming ? '确认改判' : '下一步'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
