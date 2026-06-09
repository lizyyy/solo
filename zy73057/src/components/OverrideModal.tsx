import { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';
import { useScheduleStore } from '@/store/scheduleStore';
import { cn } from '@/lib/utils';

interface OverrideModalProps {
  itemId: string;
  batchId: string;
  initial: {
    recommendedPartNo: string;
    recommendedPartName: string;
    recommendedQty: number;
  };
  onClose: () => void;
}

export default function OverrideModal({ itemId, batchId, initial, onClose }: OverrideModalProps) {
  const { submitOverride, loading } = useScheduleStore();
  const [partNo, setPartNo] = useState(initial.recommendedPartNo);
  const [partName, setPartName] = useState(initial.recommendedPartName);
  const [qty, setQty] = useState<number>(initial.recommendedQty);
  const [reason, setReason] = useState('');
  const [impactExplanation, setImpactExplanation] = useState('');
  const [reviewer, setReviewer] = useState('复核人-当前');

  const canSubmit =
    partNo.trim() !== '' &&
    partName.trim() !== '' &&
    qty > 0 &&
    reason.trim() !== '' &&
    impactExplanation.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await submitOverride({
        itemId,
        batchId,
        reason: reason.trim(),
        impactExplanation: impactExplanation.trim(),
        createdBy: reviewer.trim() || '复核人-当前',
        before: {
          partNo: initial.recommendedPartNo,
          partName: initial.recommendedPartName,
          qty: initial.recommendedQty,
        },
        after: {
          partNo: partNo.trim(),
          partName: partName.trim(),
          qty,
        },
      });
      onClose();
    } catch (e) {
      // 错误已在 store 中设置
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/80 p-4">
      <div className="bg-ink-800 border-2 border-warn-400/70 rounded-sm w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-ink-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warn-400" />
            <h2 className="text-lg font-semibold text-ink-100 font-display">人工改判</h2>
            <span className="px-2 py-0.5 text-xs font-mono bg-ink-700 text-ink-200 border border-ink-500 rounded-sm">
              {batchId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-300 hover:text-ink-100 hover:bg-ink-700 rounded-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <div className="text-xs text-ink-400 mb-2 font-medium uppercase tracking-wider">
              改判前（原始推荐）
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-ink-700/60 border border-ink-500 rounded-sm p-3">
                <div className="text-xs text-ink-400 mb-1">备件号</div>
                <div className="font-mono text-sm text-ink-200">{initial.recommendedPartNo}</div>
              </div>
              <div className="bg-ink-700/60 border border-ink-500 rounded-sm p-3">
                <div className="text-xs text-ink-400 mb-1">名称</div>
                <div className="text-sm text-ink-200 truncate">{initial.recommendedPartName}</div>
              </div>
              <div className="bg-ink-700/60 border border-ink-500 rounded-sm p-3">
                <div className="text-xs text-ink-400 mb-1">数量</div>
                <div className="font-mono text-sm text-ink-200 text-right">{initial.recommendedQty}</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-10 px-3 py-0.5 text-xs bg-warn-400/20 text-warn-100 border border-warn-400 rounded-sm font-medium">
              改判后
            </div>
            <div className="border-2 border-warn-400/60 rounded-sm p-4 pt-6 bg-warn-400/5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-ink-300 mb-1 font-medium">备件号 *</label>
                  <input
                    type="text"
                    value={partNo}
                    onChange={(e) => setPartNo(e.target.value)}
                    className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 font-mono focus:outline-none focus:border-warn-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-300 mb-1 font-medium">名称 *</label>
                  <input
                    type="text"
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-warn-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-300 mb-1 font-medium">数量 *</label>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 font-mono text-right focus:outline-none focus:border-warn-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink-300 mb-1 font-medium">
              改判原因 *
              <span className="text-ink-500 font-normal ml-2">（说明照片证据看到了什么）</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="例如：照片显示该部件实际为继电器粘连而非触点磨损，原型号不适用..."
              className={cn(
                'w-full bg-ink-700 border rounded-sm px-3 py-2 text-sm text-ink-100 focus:outline-none resize-none',
                reason.trim() === '' ? 'border-rust-400/50 focus:border-rust-400' : 'border-ink-500 focus:border-warn-400'
              )}
            />
          </div>

          <div>
            <label className="block text-xs text-ink-300 mb-1 font-medium">
              影响说明 *
              <span className="text-ink-500 font-normal ml-2">（改判如何影响月度汇总，平均值是否会掩盖异常）</span>
            </label>
            <textarea
              value={impactExplanation}
              onChange={(e) => setImpactExplanation(e.target.value)}
              rows={3}
              placeholder="例如：改判后备件成本增加约12%，但原推荐长期掩盖了继电器批量故障问题..."
              className={cn(
                'w-full bg-ink-700 border rounded-sm px-3 py-2 text-sm text-ink-100 focus:outline-none resize-none',
                impactExplanation.trim() === '' ? 'border-rust-400/50 focus:border-rust-400' : 'border-ink-500 focus:border-warn-400'
              )}
            />
          </div>

          <div>
            <label className="block text-xs text-ink-300 mb-1 font-medium">复核人</label>
            <input
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-warn-400"
            />
          </div>
        </div>

        <div className="p-4 border-t border-ink-600 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-industrial border-ink-500 text-ink-200 bg-ink-700/50 text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="btn-industrial border-warn-400 text-warn-100 bg-warn-400/15 text-sm"
          >
            <Send className="w-4 h-4" />
            提交改判
          </button>
        </div>
      </div>
    </div>
  );
}
