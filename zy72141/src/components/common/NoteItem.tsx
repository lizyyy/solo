import { Note } from '@/types';
import { formatDateTimeShort } from '@/utils/dateUtils';
import { findTextDiff } from '@/utils/stringUtils';
import { User, Clock, Plus, Minus } from 'lucide-react';

interface NoteItemProps {
  note: Note;
  trackName?: string;
}

export function NoteItem({ note, trackName }: NoteItemProps) {
  const showDiff = note.isSupplement && note.previousContent && note.previousContent.trim();
  
  const diff = showDiff 
    ? findTextDiff(note.previousContent!, note.content)
    : null;

  return (
    <div className={`
      card border-l-4 transition-all duration-300
      ${note.isSupplement ? 'border-l-studio-amber' : 'border-l-gray-300'}
      animate-slide-in
    `}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {note.isSupplement && (
            <span className="px-2 py-0.5 bg-studio-amber/10 text-studio-amber text-xs font-medium rounded-full">
              补录
            </span>
          )}
          {trackName && (
            <span className="text-sm font-medium text-studio-text">
              {trackName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-studio-textMuted">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {note.author}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateTimeShort(note.createdAt)}
          </div>
        </div>
      </div>

      <p className="text-studio-text whitespace-pre-wrap">
        {note.content}
      </p>

      {showDiff && diff && (diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          <p className="text-xs font-medium text-studio-textMuted">
            补录差异：
          </p>
          
          {note.previousContent && (
            <div className="p-2 bg-gray-50 rounded text-sm text-studio-textMuted">
              <span className="text-xs font-medium text-gray-500">原记录：</span>
              {note.previousContent}
            </div>
          )}

          {diff.removed.length > 0 && (
            <div className="flex items-start gap-1.5 text-red-600 text-sm">
              <Minus className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                移除：{diff.removed.map((w, i) => (
                  <span key={i} className="bg-red-100 px-1 rounded mx-0.5">
                    {w}
                  </span>
                ))}
              </span>
            </div>
          )}

          {diff.added.length > 0 && (
            <div className="flex items-start gap-1.5 text-green-600 text-sm">
              <Plus className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                新增：{diff.added.map((w, i) => (
                  <span key={i} className="bg-green-100 px-1 rounded mx-0.5">
                    {w}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
