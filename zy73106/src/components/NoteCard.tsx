import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/date';
import { Trash2, Tag as TagIcon, User } from 'lucide-react';
import type { NoteBlock } from '@/types';
import { NOTE_TAG_LABELS } from '@/types';

interface NoteCardProps {
  note: NoteBlock;
  onDelete?: (id: string) => void;
  isOldVersion?: boolean;
}

const tagColor: Record<string, string> = {
  initial: 'border-steel-400 text-steel-300 bg-steel-700/50',
  supplement: 'border-[#E67E22] text-[#F39C12] bg-[#784212]/20',
  review: 'border-[#3498DB] text-[#5DADE2] bg-[#1A5276]/20',
  fix: 'border-[#27AE60] text-[#2ECC71] bg-[#186A3B]/20',
};

export default function NoteCard({ note, onDelete, isOldVersion }: NoteCardProps) {
  const isRaw = note.isRawBimClue;
  const tc = tagColor[note.tag] || tagColor.initial;

  return (
    <div
      className={cn(
        'panel p-4 mb-3 relative transition-all',
        isRaw && 'border-l-4 border-l-steel-400 bg-steel-800/60',
        isOldVersion && 'opacity-60 bg-steel-900/60',
      )}
    >
      <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-mono uppercase tracking-wider', tc)}>
            <TagIcon className="w-3 h-3" />
            {NOTE_TAG_LABELS[note.tag]}
          </span>
          <span className="text-[10px] font-mono text-steel-400 px-1.5 py-0.5 border border-steel-600">
            {note.versionId.includes('v1') ? 'V1.0' : 'V0.9'}
          </span>
          {isRaw && (
            <span className="text-[10px] font-mono text-steel-300 px-1.5 py-0.5 border border-dashed border-steel-500 italic">
              BIM原始线索 · 不可删除
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-mono text-steel-400">
            <User className="w-3 h-3" />
            {note.authorName}
          </span>
          <span className="text-[11px] font-mono text-steel-500">
            {formatDateTime(note.createdAt)}
          </span>
          {!isRaw && onDelete && (
            <button
              onClick={() => onDelete(note.id)}
              className="text-steel-500 hover:text-[#E74C3C] transition-colors p-1"
              title="删除备注"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div
        className={cn(
          'text-sm leading-relaxed',
          isRaw
            ? 'text-steel-300 italic font-mono text-xs bg-steel-900/50 p-3 border-l-2 border-l-steel-500'
            : 'text-steel-200',
        )}
      >
        {note.content}
      </div>
    </div>
  );
}
