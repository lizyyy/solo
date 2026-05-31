import React, { useState } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';

const EntryEditor: React.FC = () => {
  const { editingEntry, setEditingEntry, setRightPanel, updateEntry, adjustments } = useProjectStore();
  const [startTime, setStartTime] = useState(editingEntry?.startTime || 0);
  const [endTime, setEndTime] = useState(editingEntry?.endTime || 0);
  const [text, setText] = useState(editingEntry?.text || '');

  if (!editingEntry) return null;

  const entryAdjustments = adjustments.filter((a) => a.entryId === editingEntry.id).reverse();

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const handleSave = () => {
    updateEntry(
      editingEntry.id,
      {
        startTime,
        endTime,
        text,
      },
      'editor'
    );
    setEditingEntry(null);
    setRightPanel(null);
  };

  const handleCancel = () => {
    setEditingEntry(null);
    setRightPanel(null);
  };

  const handleReset = () => {
    setStartTime(editingEntry.originalStartTime);
    setEndTime(editingEntry.originalEndTime);
    setText(editingEntry.originalText);
  };

  return (
    <div className="h-full bg-[#16213E] border-l border-[#2A2A4E] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A4E]">
        <h3 className="font-mono font-bold text-white">编辑字幕</h3>
        <button
          onClick={handleCancel}
          className="p-1 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {editingEntry.isManuallyAdjusted && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#FF6B35]/20 border border-[#FF6B35]/50 rounded-lg">
            <span className="w-2 h-2 bg-[#FF6B35] rounded-full animate-pulse" />
            <span className="text-sm text-[#FF6B35]">已人工校正</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-gray-400">开始时间 (秒)</label>
          <input
            type="number"
            step="0.001"
            value={startTime}
            onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-[#1A1A2E] border border-[#2A2A4E] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] font-mono"
          />
          <span className="text-xs text-gray-500 font-mono">{formatTimestamp(startTime)}</span>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">结束时间 (秒)</label>
          <input
            type="number"
            step="0.001"
            value={endTime}
            onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-[#1A1A2E] border border-[#2A2A4E] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] font-mono"
          />
          <span className="text-xs text-gray-500 font-mono">{formatTimestamp(endTime)}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">字幕文本</label>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={12} />
              还原原始
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-[#1A1A2E] border border-[#2A2A4E] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] resize-none"
          />
          <div className="text-xs text-gray-500 p-2 bg-[#1A1A2E] rounded border border-[#2A2A4E]">
            <span className="text-gray-400">原始文本：</span>
            <p>{editingEntry.originalText}</p>
          </div>
        </div>

        {entryAdjustments.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400">校正历史</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {entryAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="p-2 bg-[#1A1A2E] rounded-lg border border-[#2A2A4E]"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{adj.operator}</span>
                    <span>{new Date(adj.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-1.5 py-0.5 bg-[#0F3460] rounded text-[#64B5F6] font-mono text-xs">
                      {adj.field}
                    </span>
                    <span className="text-red-400 line-through">{adj.oldValue}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-[#2EC4B6]">{adj.newValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#2A2A4E] flex gap-3">
        <button
          onClick={handleCancel}
          className="flex-1 px-4 py-2 border border-[#2A2A4E] text-gray-400 rounded-lg hover:bg-[#1A1A2E] transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-[#FF6B35] hover:bg-[#ff7a4a] text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Check size={16} />
          保存
        </button>
      </div>
    </div>
  );
};

export default EntryEditor;
