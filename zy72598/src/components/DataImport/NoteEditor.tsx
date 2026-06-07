import { useState } from 'react';
import { ParamNote, ThresholdItem } from '@/types';
import { Save, Plus, Trash2, Edit3 } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';

interface NoteEditorProps {
  existingNote?: ParamNote | null;
  experimentId: string;
}

export const NoteEditor = ({ existingNote, experimentId }: NoteEditorProps) => {
  const { saveParamNote } = useExperimentStore();
  const [isEditing, setIsEditing] = useState(!existingNote);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>(
    existingNote?.thresholds || [
      { metric: 'ctr_weight', value: 0.4, note: '点击率权重' },
      { metric: 'cvr_weight', value: 0.3, note: '转化率权重' },
      { metric: 'stay_weight', value: 0.3, note: '停留时长权重' },
    ]
  );
  const [notes, setNotes] = useState(existingNote?.notes || '');

  const handleAddThreshold = () => {
    setThresholds([...thresholds, { metric: '', value: 0, note: '' }]);
  };

  const handleRemoveThreshold = (index: number) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  const handleThresholdChange = (index: number, field: keyof ThresholdItem, value: string | number) => {
    const newThresholds = [...thresholds];
    newThresholds[index] = { ...newThresholds[index], [field]: value };
    setThresholds(newThresholds);
  };

  const handleSave = () => {
    saveParamNote(experimentId, { thresholds, notes });
    setIsEditing(false);
  };

  if (!isEditing && existingNote) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-lg font-semibold text-gray-900 flex items-center gap-2"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            <Edit3 className="w-5 h-5 text-amber-500" />
            阈值调参笔记
          </h3>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            编辑
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">阈值设置</p>
            <div className="grid grid-cols-3 gap-3">
              {existingNote.thresholds.map((t, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{t.note || t.metric}</p>
                  <p className="text-lg font-bold text-gray-900">{t.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">备注说明</p>
            <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{existingNote.notes}</p>
          </div>
          <p className="text-xs text-gray-400">
            记录于 {new Date(existingNote.recordedAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3
        className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"
        style={{ fontFamily: "'Source Serif Pro', serif" }}
      >
        <Edit3 className="w-5 h-5 text-amber-500" />
        {existingNote ? '编辑阈值调参笔记' : '录入阈值调参笔记'}
      </h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">阈值设置</p>
            <button
              onClick={handleAddThreshold}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加阈值
            </button>
          </div>
          <div className="space-y-2">
            {thresholds.map((threshold, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <input
                  type="text"
                  placeholder="指标名"
                  value={threshold.metric}
                  onChange={(e) => handleThresholdChange(index, 'metric', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="值"
                  value={threshold.value}
                  onChange={(e) => handleThresholdChange(index, 'value', parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="说明"
                  value={threshold.note || ''}
                  onChange={(e) => handleThresholdChange(index, 'note', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleRemoveThreshold(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">备注说明</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="请输入调参笔记说明..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            保存笔记
          </button>
        </div>
      </div>
    </div>
  );
};
