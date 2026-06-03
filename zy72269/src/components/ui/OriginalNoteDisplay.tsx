import { OriginalNote } from '@/types';

interface OriginalNoteDisplayProps {
  notes: OriginalNote[];
  showSource?: boolean;
}

export default function OriginalNoteDisplay({ notes, showSource = true }: OriginalNoteDisplayProps) {
  if (!notes || notes.length === 0) return null;

  const getNoteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      handwritten: '手写',
      photo: '照片',
      typed: '录入',
      ambiguous: '存疑'
    };
    return labels[type] || type;
  };

  const getNoteTypeVariant = (type: string, isAmbiguous: boolean) => {
    if (isAmbiguous) return 'warning';
    if (type === 'handwritten') return 'info';
    if (type === 'photo') return 'info';
    return 'default';
  };

  return (
    <div className="space-y-2 mt-2">
      {notes.map((note) => (
        <div key={note.id} className="note-original">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 border ${
              getNoteTypeVariant(note.noteType, note.isAmbiguous) === 'warning'
                ? 'border-accent-warning/50 text-accent-warning'
                : 'border-primary-500 text-primary-300'
            }`}>
              [{getNoteTypeLabel(note.noteType)}]
            </span>
            {note.isAmbiguous && (
              <span className="text-xs text-accent-warning animate-pulse">
                ⚠ 存疑备注
              </span>
            )}
            {showSource && note.sourceFile && (
              <span className="text-xs text-primary-500">
                来源: {note.sourceFile}{note.lineNumber ? ` #${note.lineNumber}` : ''}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">
            {note.content}
          </p>
        </div>
      ))}
    </div>
  );
}
