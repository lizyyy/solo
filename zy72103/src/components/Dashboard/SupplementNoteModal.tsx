import { useState } from 'react';
import { useDataStore } from '@/store/useDataStore';
import type { FieldType } from '@/types';
import { X, FileText, User, Send, GitCompare } from 'lucide-react';
import { FIELD_LABELS } from '@/config/thresholds';
import { compareAnalysisResults } from '@/algorithms/thresholdJudgment';
import { formatDateTime } from '@/utils/csvParser';

interface SupplementNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupplementNoteModal({ isOpen, onClose }: SupplementNoteModalProps) {
  const { selectedRecordId, records, currentAnalysis, previousAnalysis, addSupplementNote } = useDataStore();
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('何工');
  const [affectedFields, setAffectedFields] = useState<FieldType[]>(['temperature']);

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  if (!isOpen || !selectedRecord) return null;

  const handleFieldToggle = (field: FieldType) => {
    setAffectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  const handleSubmit = () => {
    if (!content.trim() || !selectedRecordId) return;
    addSupplementNote(selectedRecordId, content.trim(), author, affectedFields);
    setContent('');
    onClose();
  };

  const comparison = previousAnalysis && currentAnalysis
    ? compareAnalysisResults(previousAnalysis, currentAnalysis)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-200">补录工况备注</h2>
              <p className="text-sm text-slate-400">
                记录 {selectedRecord.id} · {formatDateTime(selectedRecord.timestamp)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <User className="w-4 h-4 inline mr-1.5" />
              记录人
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="输入记录人姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              影响字段（多选）
            </label>
            <div className="flex flex-wrap gap-2">
              {(['temperature', 'voltage', 'current', 'internalResistance'] as FieldType[]).map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => handleFieldToggle(field)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    affectedFields.includes(field)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  {FIELD_LABELS[field]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              工况备注内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              placeholder="例如：14:35 通风系统临时关闭，可能导致温度升高..."
            />
          </div>

          {comparison && (previousAnalysis !== currentAnalysis) && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
                <GitCompare className="w-4 h-4" />
                补录后分析差异
              </div>
              <p className="text-slate-300 text-sm">{comparison.summary}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-400 hover:text-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            保存备注
          </button>
        </div>
      </div>
    </div>
  );
}
