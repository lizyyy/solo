import { useState } from 'react';
import { X, Plus, Trash2, MessageSquare, AlertTriangle } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    version: string;
    conclusion: string;
    isOldCriteria: boolean;
    evidences: { field: string; value: string; remark?: string }[];
  }) => void;
}

export function ReviewModal({ isOpen, onClose, onSubmit }: ReviewModalProps) {
  const [version, setVersion] = useState('v2.3.1');
  const [conclusion, setConclusion] = useState('');
  const [isOldCriteria, setIsOldCriteria] = useState(false);
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
    if (conclusion.trim() && validEvidences.length > 0 && version.trim()) {
      onSubmit({
        version: version.trim(),
        conclusion: conclusion.trim(),
        isOldCriteria,
        evidences: validEvidences,
      });
      setVersion('v2.3.1');
      setConclusion('');
      setIsOldCriteria(false);
      setEvidences([{ field: '', value: '', remark: '' }]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <MessageSquare size={16} className="text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">补看提示词版本号</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">提示词版本</label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="如：v2.3.1"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOldCriteria}
                  onChange={(e) => setIsOldCriteria(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="flex items-center gap-1 text-sm text-orange-700">
                  <AlertTriangle size={14} />
                  旧口径数据
                </span>
              </label>
            </div>
          </div>

          {isOldCriteria && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-xs text-orange-700">
                ⚠️ 标记为旧口径后，系统将自动与人工改判表进行对比，如结论不一致将标记为冲突，需手动确认。
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">提取结论</label>
            <textarea
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="请输入现场说法提取的结论..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">证据明细</label>
              <button
                onClick={addEvidence}
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
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
                          placeholder="如：材料完整性"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">字段值</label>
                        <input
                          value={ev.value}
                          onChange={(e) => updateEvidence(idx, 'value', e.target.value)}
                          placeholder="如：完整"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
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
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
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
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors"
          >
            确认补看
          </button>
        </div>
      </div>
    </div>
  );
}
