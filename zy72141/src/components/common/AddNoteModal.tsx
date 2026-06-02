import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Track } from '@/types';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: Track | null;
  isSupplement?: boolean;
}

export function AddNoteModal({ isOpen, onClose, track, isSupplement = false }: AddNoteModalProps) {
  const { currentRecordId, addNote, notes } = useAppStore();
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('老许');

  if (!isOpen || !currentRecordId) return null;

  const existingNote = track 
    ? notes.find(n => n.trackId === track.id && !n.isSupplement)
    : null;

  const handleSubmit = () => {
    if (!content.trim()) return;

    addNote({
      recordId: currentRecordId,
      trackId: track?.id,
      content: content.trim(),
      author: author.trim() || '老许',
      isSupplement,
      previousContent: isSupplement ? existingNote?.content : undefined,
    });

    setContent('');
    setAuthor('老许');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in-up">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-serif font-bold text-studio-text text-lg">
            {isSupplement ? '补录备注' : '添加备注'}
            {track && <span className="text-base font-normal text-studio-textMuted ml-2">· {track.name}</span>}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-studio-textMuted" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isSupplement && existingNote && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-studio-textMuted mb-1">现有备注：</p>
              <p className="text-sm text-studio-text">{existingNote.content}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-studio-text mb-1.5">
              你的名字
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="input-field"
              placeholder="谁写的备注？"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-studio-text mb-1.5">
              备注内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-field min-h-[120px] resize-none"
              placeholder={isSupplement 
                ? "补录一下之前没说清楚的事情..." 
                : "有什么要记下来的？"}
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSupplement ? '确认补录' : '添加备注'}
          </button>
        </div>
      </div>
    </div>
  );
}
