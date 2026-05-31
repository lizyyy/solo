import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { RecordType, MaterialType } from '@/types';

interface RecordFormProps {
  onSubmit: (data: {
    type: RecordType;
    content: string;
    materialType: MaterialType;
    operator: string;
  }) => void;
  onCancel: () => void;
}

export const RecordForm: React.FC<RecordFormProps> = ({ onSubmit, onCancel }) => {
  const [type, setType] = useState<RecordType>('operation');
  const [materialType, setMaterialType] = useState<MaterialType>('supplement');
  const [content, setContent] = useState('');
  const [operator, setOperator] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    onSubmit({
      type,
      materialType,
      content: content.trim(),
      operator: operator.trim() || '匿名',
    });
  };

  const typeOptions = [
    { value: 'operation', label: '操作记录' },
    { value: 'script', label: '脚本变更' },
    { value: 'note', label: '备注' },
    { value: 'score', label: '评分相关' },
  ];

  return (
    <div className="border-2 border-lab-border bg-lab-card p-4 animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono text-lab-accent">添加记录</h3>
        <button
          onClick={onCancel}
          className="p-1 text-lab-text-muted hover:text-lab-text transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">记录类型</label>
          <div className="grid grid-cols-4 gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value as RecordType)}
                className={`p-2 text-xs font-mono border-2 transition-all ${
                  type === opt.value
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
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">材料性质</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMaterialType('supplement')}
              className={`p-3 text-xs font-mono border-2 transition-all ${
                materialType === 'supplement'
                  ? 'border-lab-supplement text-lab-supplement bg-lab-supplement/10'
                  : 'border-lab-border text-lab-text-muted hover:border-lab-supplement/50'
              }`}
            >
              <span className="block text-lg mb-1">📝</span>
              补材料
              <span className="block text-[10px] mt-1 opacity-70">仅补充记录，不影响结论</span>
            </button>
            <button
              type="button"
              onClick={() => setMaterialType('conclusion_change')}
              className={`p-3 text-xs font-mono border-2 transition-all ${
                materialType === 'conclusion_change'
                  ? 'border-lab-conclusion text-lab-conclusion bg-lab-conclusion/10'
                  : 'border-lab-border text-lab-text-muted hover:border-lab-conclusion/50'
              }`}
            >
              <span className="block text-lg mb-1">⚠️</span>
              改结论
              <span className="block text-[10px] mt-1 opacity-70">影响最终判定结果</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">
            记录内容 <span className="text-lab-conclusion">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入记录内容..."
            className="w-full h-24 p-3 bg-lab-bg border-2 border-lab-border text-lab-text text-sm font-mono focus:border-lab-accent focus:outline-none resize-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-lab-text-muted mb-2 font-mono">操作人</label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
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
            disabled={!content.trim()}
            className="flex-1 py-2 bg-lab-accent text-lab-bg text-sm font-mono flex items-center justify-center gap-2 hover:bg-lab-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            添加记录
          </button>
        </div>
      </form>
    </div>
  );
};
