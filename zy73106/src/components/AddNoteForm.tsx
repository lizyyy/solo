import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Send } from 'lucide-react';
import type { NoteTag } from '@/types';
import { NOTE_TAG_LABELS } from '@/types';

interface AddNoteFormProps {
  onSubmit: (payload: { content: string; tag: NoteTag }) => void;
  disabled?: boolean;
}

const tagList: NoteTag[] = ['supplement', 'review', 'fix'];

export default function AddNoteForm({ onSubmit, disabled }: AddNoteFormProps) {
  const [content, setContent] = useState('');
  const [tag, setTag] = useState<NoteTag>('supplement');
  const [expanded, setExpanded] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({ content, tag });
    setContent('');
    setExpanded(false);
  };

  return (
    <div className="panel-bordered p-4">
      {!expanded ? (
      <button
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-2 text-sm font-mono text-steel-400',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        <Plus className="w-4 h-4" />
        追加备注 · 不覆盖历史记录
      </button>
      ) : (
        <form onSubmit={submit}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {tagList.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={cn(
                  'px-3 py-1 text-xs font-mono uppercase tracking-wider border-2 transition-all',
                  tag === t
                    ? 'border-[#E67E22] text-[#F39C12] bg-[#784212]/30'
                    : 'border-steel-600 text-steel-400 hover:border-steel-500',
                )}
              >
                {NOTE_TAG_LABELS[t]}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入备注内容..."
            rows={3}
            className={cn(
              'w-full bg-steel-900 border border-steel-600 text-steel-100 px-3 py-2 font-mono text-sm',
              'focus:outline-none focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22]',
              'resize-none placeholder-steel-500',
            )}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] font-mono text-steel-500">
              追加式记录，保存后无法编辑，可删除非BIM线索
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setContent('');
                }}
                className="px-3 py-1.5 text-xs font-mono uppercase border-2 border-steel-600 text-steel-400 hover:bg-steel-700"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className={cn(
                  'px-4 py-1.5 text-xs font-mono uppercase border-2 transition-all',
                  content.trim()
                    ? 'border-[#27AE60] text-[#2ECC71] bg-[#186A3B]/40 hover:bg-[#186A3B]/60'
                    : 'border-steel-600 text-steel-500 cursor-not-allowed',
                )}
              >
                <Send className="w-3.5 h-3.5 inline mr-1" />
                提交备注
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
