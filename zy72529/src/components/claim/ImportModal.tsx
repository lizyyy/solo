import { useState } from 'react';
import { X, Plus, Trash2, FileText } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    conclusion: string;
    evidences: { field: string; value: string; remark?: string }[];
  }) => void;
}

export function ImportModal({ isOpen, onClose, onSubmit }: ImportModalProps) {
  const [conclusion, setConclusion] = useState('');
  const [evidences, setEvidences] = useState<{ field: string; value: string; remark?: string }[]>([
    { field: '', value: '', remark: '' },
  ]);

  if (!isOpen) return null;

  const addEvidence = () => {
    setEvidences([...evidences, { field: '', value: '', remark: '' }]);
  };

  const removeEvidence = (idx: number) => {
    if (evidences.length > 1) {
      setEvidences(evidences.filter((_, i) => i !== idx));
    }
  };

  const updateEvidence = (idx: number, field: string, value: string) => {
    const updated = [...evidences];
    (updated[idx] as any)[field] = value;
    setEvidences(updated);
  };

  const handleSubmit = () => {
    const validEvidences = evidences.filter((e) => e.field.trim() && e.value.trim());
    if (conclusion.trim() && validEvidences.length > 0) {
      onSubmit({ conclusion: conclusion.trim(), evidences: validEvidences });
      setConclusion('');
      setEvidences([{ field: '', value: '', remark: '' }]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">导入人工改判表</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">审核结论</label>
            <textarea
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="请输入人工审核的最终结论..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">证据明细</label>
              <button
                onClick={addEvidence}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus size={14} />
                添加字段
              </button>
            </div>
            <div className="space-y-3">
              {evidences.map((ev, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">字段名</label>
                        <input
                          value={ev.field}
                          onChange={(e) => updateEvidence(idx, 'field', e.target.value)}
                          placeholder="如：理赔金额"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">字段值</label>
                        <input
                          value={ev.value}
                          onChange={(e) => updateEvidence(idx, 'value', e.target.value)}
                          placeholder="如：12,500 元"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    {evidences.length > 1 && (
                      <button
                        onClick={() => removeEvidence(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">备注（可选）</label>
                    <input
                      value={ev.remark || ''}
                      onChange={(e) => updateEvidence(idx, 'remark', e.target.value)}
                      placeholder="补充说明..."
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
