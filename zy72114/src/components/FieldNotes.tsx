import { FieldNote } from '@/types';
import { cn } from '@/lib/utils';

interface FieldNotesProps {
  notes: FieldNote[];
  onUpdate: (id: string, updates: Partial<FieldNote>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function FieldNotes({
  notes,
  onUpdate,
  onAdd,
  onRemove,
}: FieldNotesProps) {
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="eng-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="eng-section-title mb-0">现场备注</h3>
        <button onClick={onAdd} className="eng-btn eng-btn-sm eng-btn-primary">
          + 添加备注
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12 text-ink-500">
          暂无备注，点击上方按钮添加
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                'border-2 p-4 transition-all duration-200',
                note.isSupplementary
                  ? 'bg-blueprint-50 border-blueprint-300'
                  : 'bg-white border-ink-200'
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  {note.isSupplementary && (
                    <span className="eng-badge eng-badge-info">
                      补充备注
                    </span>
                  )}
                  {note.isOriginal && (
                    <span className="eng-badge eng-badge-safe">
                      原始记录
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(note.id)}
                  className="eng-btn eng-btn-sm eng-btn-danger"
                >
                  删除
                </button>
              </div>

              <div className="mb-3">
                {note.isOriginal ? (
                  <div className="raw-note">{note.content}</div>
                ) : (
                  <textarea
                    value={note.content}
                    onChange={(e) =>
                      onUpdate(note.id, { content: e.target.value })
                    }
                    className="eng-input min-h-[120px] resize-y font-mono"
                    placeholder="输入备注内容..."
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-ink-600 font-mono">
                <div className="flex items-center gap-1">
                  <span className="text-ink-500">记录人:</span>
                  {note.isOriginal ? (
                    <span>{note.recorder || '-'}</span>
                  ) : (
                    <input
                      type="text"
                      value={note.recorder}
                      onChange={(e) =>
                        onUpdate(note.id, { recorder: e.target.value })
                      }
                      className="eng-input w-32 py-1 text-sm"
                      placeholder="记录人"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-ink-500">记录时间:</span>
                  {note.isOriginal ? (
                    <span>{formatDateTime(note.recordedAt)}</span>
                  ) : (
                    <input
                      type="datetime-local"
                      value={note.recordedAt.slice(0, 16)}
                      onChange={(e) =>
                        onUpdate(note.id, { recordedAt: e.target.value })
                      }
                      className="eng-input py-1 text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
