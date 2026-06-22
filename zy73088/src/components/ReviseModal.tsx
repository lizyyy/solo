import { useState } from 'react';
import {
  X,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import { ConclusionOptions, type Conclusion } from '@/shared/types';

interface ReviseModalProps {
  onClose: () => void;
}

export default function ReviseModal({ onClose }: ReviseModalProps) {
  const record = useWorkbenchStore((s) => s.record);
  const reviseConclusion = useWorkbenchStore((s) => s.reviseConclusion);

  const [newConclusion, setNewConclusion] = useState<Conclusion>(
    record?.conclusion || 'scheme_a'
  );
  const [confidence, setConfidence] = useState(record?.confidence ?? 0.8);
  const [reviseReason, setReviseReason] = useState('');
  const [extraRemarks, setExtraRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ reason?: string }>({});

  const handleSubmit = async () => {
    const newErrors: { reason?: string } = {};
    if (!reviseReason.trim()) {
      newErrors.reason = '请填写改判原因';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    await reviseConclusion({
      new_conclusion: newConclusion,
      revise_reason: reviseReason.trim(),
      confidence,
      extra_remarks: extraRemarks.trim() || undefined,
    });
    setSubmitting(false);
    onClose();
  };

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Edit3 size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">改判结论</h3>
              <p className="text-slate-400 text-xs">
                {record.project_code} · {record.structural_element}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          {record.conclusion && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-700 flex items-center gap-4">
              <span className="text-slate-400 text-sm flex-shrink-0">原结论</span>
              <span
                className={`px-3 py-1 rounded-md text-sm text-white ${
                  ConclusionOptions.find(
                    (o) => o.value === record.conclusion
                  )?.color || 'bg-slate-600'
                }`}
              >
                {
                  ConclusionOptions.find(
                    (o) => o.value === record.conclusion
                  )?.label
                }{' '}
                ·{' '}
                {
                  ConclusionOptions.find(
                    (o) => o.value === record.conclusion
                  )?.desc
                }
              </span>
              <span className="text-slate-500 text-sm ml-auto">
                置信度 {(record.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-3 font-medium">
              <FileText size={14} />
              新结论
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ConclusionOptions.map((opt) => {
                const selected = newConclusion === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selected
                        ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-700/30 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conclusion"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setNewConclusion(opt.value)}
                      className="hidden"
                    />
                    <div className="flex items-start gap-2">
                      <span
                        className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${opt.color}`}
                      />
                      <div>
                        <div className="text-white text-sm font-medium">
                          {opt.label}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm text-slate-300 mb-2 font-medium">
              <span className="flex items-center gap-2">
                <Gauge size={14} />
                置信度
              </span>
              <span className="text-blue-400 font-bold">
                {(confidence * 100).toFixed(0)}%
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={confidence}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setConfidence(Math.max(0, Math.min(1, v)));
                }}
                className="w-20 bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1.5 rounded-md text-center"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
              <span>不确定</span>
              <span>高置信</span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-2 font-medium">
              <AlertTriangle size={14} className="text-amber-400" />
              改判原因
              <span className="text-red-400 text-xs">*必填</span>
            </label>
            <textarea
              value={reviseReason}
              onChange={(e) => {
                setReviseReason(e.target.value);
                if (errors.reason) setErrors({});
              }}
              rows={4}
              placeholder="请详细说明改判的原因，包括检测数据、规范依据、现场情况等..."
              className={`w-full bg-slate-700/50 border rounded-lg text-white text-sm px-3 py-2.5 outline-none resize-none placeholder-slate-500 transition-colors ${
                errors.reason
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-600 focus:border-blue-500'
              }`}
            />
            {errors.reason && (
              <div className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle size={12} />
                {errors.reason}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-2 font-medium">
              <MessageSquare size={14} />
              补充备注（可选）
            </label>
            <textarea
              value={extraRemarks}
              onChange={(e) => setExtraRemarks(e.target.value)}
              rows={2}
              placeholder="额外需要记录的备注信息..."
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm px-3 py-2.5 outline-none resize-none placeholder-slate-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {submitting ? '提交中...' : '确认改判'}
          </button>
        </div>
      </div>
    </div>
  );
}
