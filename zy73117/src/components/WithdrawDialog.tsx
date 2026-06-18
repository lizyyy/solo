import { X, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/store/useStore';

interface WithdrawDialogProps {
  materialId: string;
  currentConclusion: string;
  onClose: () => void;
}

export function WithdrawDialog({ materialId, currentConclusion, onClose }: WithdrawDialogProps) {
  const withdrawRecord = useStore((state) => state.withdrawRecord);
  const [reason, setReason] = useState('');
  const [operator, setOperator] = useState('阿宁');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    withdrawRecord(materialId, reason.trim(), operator.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-industrial-800 border border-industrial-700 rounded-lg w-full max-w-md mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-danger-700/50 bg-danger-900/20">
          <h3 className="text-lg font-semibold text-danger-300 flex items-center gap-2">
            <Undo2 className="w-5 h-5" />
            撤回当前结论
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-industrial-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-industrial-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-danger-900/20 border border-danger-700/50 rounded p-3">
            <p className="text-xs text-danger-400 mb-1">即将撤回的结论：</p>
            <p className="text-sm text-danger-200">「{currentConclusion}」</p>
          </div>

          <div>
            <label className="label-field">操作人</label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label-field">撤回原因 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请详细说明撤回原因，例如：检测数据有误、现场条件变化、设计变更等..."
              className="input-field resize-none h-24"
              required
            />
          </div>

          <div className="bg-industrial-900/50 rounded p-3 border border-industrial-700">
            <p className="text-xs text-industrial-400">
              <span className="text-warning-400">注意：</span>
              撤回操作将被永久记录在时间线中，后续可重新提交新结论。撤回原因将作为现场老师审核时的重要依据。
            </p>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-700">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
            className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认撤回
          </button>
        </div>
      </div>
    </div>
  );
}
