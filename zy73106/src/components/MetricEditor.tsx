import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Edit3, AlertCircle } from 'lucide-react';
import type { DrawingMetrics } from '@/types';
import { METRIC_FIELD_LABELS } from '@/types';

interface MetricEditorProps {
  field: keyof DrawingMetrics;
  currentValue: number;
  onSave: (field: keyof DrawingMetrics, newValue: number, reason: string) => void;
  onClose: () => void;
}

export default function MetricEditor({ field, currentValue, onSave, onClose }: MetricEditorProps) {
  const [newValue, setNewValue] = useState(currentValue.toString());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const label = METRIC_FIELD_LABELS[field];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newValue);
    if (isNaN(num) || num < 0) {
      setError('请输入有效的非负数');
      return;
    }
    if (!reason.trim() || reason.trim().length < 2) {
      setError('变更理由至少2个字符');
      return;
    }
    if (num === currentValue) {
      setError('数值未变更');
      return;
    }
    setError('');
    onSave(field, num, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={submit} className="panel-bordered w-full max-w-md animate-stamp-in">
        <div className="flex items-center justify-between p-4 border-b-2 border-steel-600">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#E67E22]" />
            <span className="font-mono text-sm uppercase tracking-wider text-steel-200">
              编辑指标 · {label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-steel-400 hover:text-steel-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-steel-400 mb-1.5">
              原值
            </label>
            <div className="text-2xl font-display font-bold text-steel-300 p-3 bg-steel-900 border-2 border-steel-600">
              {currentValue}
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-steel-400 mb-1.5">
              新值
            </label>
            <input
              type="number"
              step="any"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className={cn(
                'w-full bg-steel-900 border-2 text-steel-100 px-3 py-2 font-mono text-xl font-bold',
                'focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22]',
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-steel-400 mb-1.5">
              变更理由 <span className="text-[#E74C3C]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="例如：V1.0模型更新，消除4处梁高冲突..."
              className={cn(
                'w-full bg-steel-900 border-2 text-steel-100 px-3 py-2 font-mono text-sm',
                'focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22]',
                'resize-none placeholder-steel-500',
              )}
            />
            <div className="text-[10px] font-mono text-steel-500 mt-1">
              变更将自动写入变更溯源日志
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 border-2 border-[#C0392B] bg-[#7B241C]/30 text-[#E74C3C] text-xs font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t-2 border-steel-600">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono uppercase border-2 border-steel-600 text-steel-400 hover:bg-steel-700"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-mono uppercase border-2 border-[#27AE60] text-[#2ECC71] bg-[#186A3B]/40 hover:bg-[#186A3B]/60"
          >
            确认变更
          </button>
        </div>
      </form>
    </div>
  );
}
