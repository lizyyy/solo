import { useState } from 'react';
import { Send, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface NoteInputProps {
  sampleId: string;
}

export function NoteInput({ sampleId }: NoteInputProps) {
  const [content, setContent] = useState('');
  const [operator, setOperator] = useState('小岑');
  const addNote = useAppStore((state) => state.addNote);

  const handleSubmit = () => {
    if (!content.trim()) return;
    addNote(sampleId, content.trim(), operator);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <User size={14} />
        <span>操作人：</span>
        <input
          type="text"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          className="w-20 border-b border-slate-300 bg-transparent px-1 py-0.5 text-center focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入补充备注，按Enter提交..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Send size={14} />
          提交
        </button>
      </div>
    </div>
  );
}
