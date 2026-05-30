import React, { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteEditorProps {
  currentNote: string;
  onSave: (content: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ currentNote, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(currentNote);

  const handleSave = () => {
    if (noteText.trim() !== currentNote) {
      onSave(noteText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNoteText(currentNote);
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-mono">当前备注</span>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 font-mono transition-colors"
          >
            <Edit2 size={12} />
            添加/修改
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="输入你的备注..."
            className={cn(
              'w-full px-3 py-2 text-sm font-mono bg-gray-900 border border-purple-500/50 rounded-lg',
              'focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400',
              'resize-none min-h-[80px] text-gray-300 placeholder-gray-600'
            )}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              <X size={12} />
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
            >
              <Save size={12} />
              保存新版本
            </button>
          </div>
          <p className="text-[10px] text-purple-500 font-mono">
            ⓘ 保存后将创建新版本，旧版本不会被覆盖
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'px-3 py-2 text-sm font-mono bg-gray-900/50 border border-gray-700 rounded-lg min-h-[40px]',
            !currentNote && 'text-gray-600 italic'
          )}
        >
          {currentNote || '暂无备注，点击右上角添加'}
        </div>
      )}
    </div>
  );
};
