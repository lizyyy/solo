import { useState } from 'react';
import { MessageSquare, Edit2, Trash2, User, Clock, FileEdit, Check, X } from 'lucide-react';
import type { Annotation } from '@/types';
import { formatTimestamp } from '@/utils/versionParser';
import { cn } from '@/lib/utils';
import { usePresetStore } from '@/store/presetStore';

interface AnnotationCardProps {
  annotation: Annotation;
}

export function AnnotationCard({ annotation }: AnnotationCardProps) {
  const { updateAnnotation, deleteAnnotation } = usePresetStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(annotation.content);

  const handleSave = () => {
    if (editContent.trim()) {
      updateAnnotation(annotation.id, { content: editContent.trim() });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(annotation.content);
    setIsEditing(false);
  };

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all duration-200',
      annotation.type === 'manual-diff'
        ? 'bg-accent-amber/10 border-accent-amber/30'
        : 'bg-synth-card border-synth-border hover:border-accent-neon/30'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {annotation.type === 'manual-diff' ? (
            <div className="p-1.5 rounded-md bg-accent-amber/20 text-accent-amber">
              <FileEdit className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-md bg-accent-neon/20 text-accent-neon">
              <MessageSquare className="w-4 h-4" />
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-synth-text">
              {annotation.type === 'manual-diff' ? '补录差异' : '备注'}
            </span>
            {annotation.field && (
              <div className="text-xs text-synth-muted font-mono">
                关联字段: {annotation.field}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-md hover:bg-synth-surface text-synth-muted hover:text-accent-neon transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteAnnotation(annotation.id)}
            className="p-1.5 rounded-md hover:bg-synth-surface text-synth-muted hover:text-accent-coral transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 bg-synth-bg border border-synth-border rounded-lg text-sm text-synth-text resize-none focus:border-accent-neon focus:outline-none"
            rows={3}
            placeholder="输入批注内容..."
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-synth-surface text-synth-muted hover:text-synth-text transition-colors"
            >
              <X className="w-3 h-3" />
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent-neon text-synth-bg hover:bg-accent-neon/90 transition-colors"
            >
              <Check className="w-3 h-3" />
              保存
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-synth-text leading-relaxed">{annotation.content}</p>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-synth-border">
        <div className="flex items-center gap-1 text-xs text-synth-muted">
          <User className="w-3 h-3" />
          {annotation.operator}
        </div>
        <div className="flex items-center gap-1 text-xs text-synth-muted">
          <Clock className="w-3 h-3" />
          {formatTimestamp(annotation.createdAt)}
        </div>
      </div>
    </div>
  );
}
