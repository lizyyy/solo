import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { AnomalyType } from '@/types';

interface AnnotationFormProps {
  recordId: string;
  onSubmit: (data: { anomalyType: AnomalyType; explanation: string; annotator: string }) => void;
  onCancel: () => void;
}

export const AnnotationForm: React.FC<AnnotationFormProps> = ({ onSubmit, onCancel }) => {
  const [anomalyType, setAnomalyType] = useState<AnomalyType>('normal');
  const [explanation, setExplanation] = useState('');
  const [annotator, setAnnotator] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (anomalyType !== 'normal' && !explanation.trim()) {
      return;
    }
    onSubmit({ anomalyType, explanation: explanation.trim(), annotator: annotator.trim() || '匿名' });
  };

  const anomalyOptions = [
    { value: 'normal', label: '正常操作' },
    { value: 'view_reset', label: '视角重置' },
    { value: 'misoperation', label: '误操作' },
    { value: 'other', label: '其他异常' },
  ];

  return (
    <div className="border-2 border-lab-border bg-lab-card p-4 animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono text-lab-accent">异常标注</h3>
        <button
          onClick={onCancel}
          className="p-1 text-lab-text-muted hover:text-lab-text transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">异常类型</label>
          <div className="grid grid-cols-2 gap-2">
            {anomalyOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnomalyType(opt.value as AnomalyType)}
                className={`p-2 text-xs font-mono border-2 transition-all ${
                  anomalyType === opt.value
                    ? 'border-lab-accent text-lab-accent bg-lab-accent/10'
                    : 'border-lab-border text-lab-text-muted hover:border-lab-text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">
            解释说明 {anomalyType !== 'normal' && <span className="text-lab-conclusion">*</span>}
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder={anomalyType !== 'normal' ? '请解释该异常的判定理由...' : '可选：添加备注说明'}
            className="w-full h-24 p-3 bg-lab-bg border-2 border-lab-border text-lab-text text-sm font-mono focus:border-lab-accent focus:outline-none resize-none"
            required={anomalyType !== 'normal'}
          />
        </div>

        <div>
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">标注人</label>
          <input
            type="text"
            value={annotator}
            onChange={(e) => setAnnotator(e.target.value)}
            placeholder="输入姓名（可选）"
            className="w-full p-2 bg-lab-bg border-2 border-lab-border text-lab-text text-sm font-mono focus:border-lab-accent focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 border-2 border-lab-border text-lab-text-muted text-sm font-mono hover:bg-lab-border/20 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={anomalyType !== 'normal' && !explanation.trim()}
            className="flex-1 py-2 bg-lab-accent text-lab-bg text-sm font-mono flex items-center justify-center gap-2 hover:bg-lab-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={14} />
            确认标注
          </button>
        </div>
      </form>
    </div>
  );
};
