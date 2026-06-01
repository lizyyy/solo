import React, { useState } from 'react';
import { Plus, X, StickyNote, Edit3 } from 'lucide-react';
import type { FieldNote, ManualCorrection, SensorData } from '../../types';
import { formatTime } from '../../utils/formatters';

interface NotesEditorProps {
  fieldNotes: FieldNote[];
  manualCorrections: ManualCorrection[];
  sensorData: SensorData[];
  onAddNote: (note: Omit<FieldNote, 'id' | 'createdAt'>) => void;
  onRemoveNote: (id: string) => void;
  onAddCorrection: (correction: Omit<ManualCorrection, 'id' | 'createdAt'>) => void;
  onRemoveCorrection: (id: string) => void;
}

export function NotesEditor({
  fieldNotes,
  manualCorrections,
  sensorData,
  onAddNote,
  onRemoveNote,
  onAddCorrection,
  onRemoveCorrection,
}: NotesEditorProps) {
  const [newNote, setNewNote] = useState('');
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    dataPointIndex: 0,
    field: 'temperature' as keyof SensorData,
    correctedValue: 0,
    reason: '',
  });
  const author = '何工';

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    onAddNote({
      timestamp: Date.now(),
      content: newNote,
      author,
    });
    setNewNote('');
  };

  const handleAddCorrection = () => {
    if (!correctionForm.reason.trim()) return;
    const originalValue = sensorData[correctionForm.dataPointIndex]?.[correctionForm.field] || 0;
    onAddCorrection({
      ...correctionForm,
      originalValue,
      author,
    });
    setShowCorrectionForm(false);
    setCorrectionForm({
      dataPointIndex: 0,
      field: 'temperature',
      correctedValue: 0,
      reason: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StickyNote className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-medium text-white">现场备注</h3>
          </div>
          <span className="text-sm text-slate-400">{fieldNotes.length} 条备注</span>
        </div>

        <div className="mb-4 flex space-x-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="添加新备注..."
            className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            className="flex items-center space-x-1 rounded-md bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
          >
            <Plus className="h-4 w-4" />
            <span>添加</span>
          </button>
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {fieldNotes.length === 0 ? (
            <p className="text-center text-slate-500">暂无备注</p>
          ) : (
            fieldNotes.map((note) => (
              <div
                key={note.id}
                className="flex items-start justify-between rounded-md bg-slate-700/50 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-white">{note.content}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatTime(note.timestamp)} · {note.author}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveNote(note.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg bg-slate-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Edit3 className="h-5 w-5 text-orange-400" />
            <h3 className="text-lg font-medium text-white">人工修正</h3>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-400">
              {manualCorrections.length} 条修正
            </span>
            <button
              onClick={() => setShowCorrectionForm(true)}
              className="flex items-center space-x-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              <span>添加修正</span>
            </button>
          </div>
        </div>

        {showCorrectionForm && (
          <div className="mb-4 space-y-3 rounded-md bg-slate-700/50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-300">数据点索引</label>
                <input
                  type="number"
                  min={0}
                  max={sensorData.length - 1}
                  value={correctionForm.dataPointIndex}
                  onChange={(e) =>
                    setCorrectionForm((prev) => ({
                      ...prev,
                      dataPointIndex: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">字段</label>
                <select
                  value={correctionForm.field}
                  onChange={(e) =>
                    setCorrectionForm((prev) => ({
                      ...prev,
                      field: e.target.value as keyof SensorData,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white"
                >
                  <option value="velocity">速度</option>
                  <option value="acceleration">加速度</option>
                  <option value="temperature">温度</option>
                  <option value="vibration">振动</option>
                  <option value="pressure">压力</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300">
                原始值:{' '}
                <span className="text-slate-400">
                  {sensorData[correctionForm.dataPointIndex]?.[correctionForm.field]?.toFixed(
                    2
                  ) || '-'}
                </span>
              </label>
              <input
                type="number"
                step="0.1"
                value={correctionForm.correctedValue}
                onChange={(e) =>
                  setCorrectionForm((prev) => ({
                    ...prev,
                    correctedValue: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="修正后的值"
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300">修正原因</label>
              <input
                type="text"
                value={correctionForm.reason}
                onChange={(e) =>
                  setCorrectionForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="请说明修正原因..."
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCorrectionForm(false)}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleAddCorrection}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
              >
                确认修正
              </button>
            </div>
          </div>
        )}

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {manualCorrections.length === 0 ? (
            <p className="text-center text-slate-500">暂无修正记录</p>
          ) : (
            manualCorrections.map((corr) => (
              <div
                key={corr.id}
                className="flex items-start justify-between rounded-md bg-orange-500/10 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-white">
                    数据点 #{corr.dataPointIndex} · {corr.field}:{' '}
                    <span className="text-slate-400 line-through">
                      {corr.originalValue.toFixed(2)}
                    </span>{' '}
                    → <span className="text-orange-400">{corr.correctedValue.toFixed(2)}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    原因: {corr.reason} · {corr.author}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveCorrection(corr.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
