import { parseDiff } from '@/utils/diff';
import { FIELD_LABELS } from '@/types';
import { formatDate } from '@/utils/version';
import { mockUsers } from '@/data/mockData';
import type { FieldChange, DiffResult } from '@/types';
import { User, Clock, MessageSquare } from 'lucide-react';

interface FieldDiffViewerProps {
  changes: FieldChange[];
}

export function FieldDiffViewer({ changes }: FieldDiffViewerProps) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-film-text-muted">
        此字段无变更记录
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {changes.map((change) => (
        <FieldChangeCard key={change.id} change={change} />
      ))}
    </div>
  );
}

interface FieldChangeCardProps {
  change: FieldChange;
}

function FieldChangeCard({ change }: FieldChangeCardProps) {
  const modifier = mockUsers.find((u) => u.id === change.modifiedBy);
  const diffParts = parseDiff(change.diff);

  return (
    <div className="bg-film-card border border-film-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-film-primary">
          {FIELD_LABELS[change.fieldName] || change.fieldName}
        </span>
        <div className="flex items-center gap-3 text-xs text-film-text-muted">
          {modifier && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {modifier.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(change.modifiedAt)}
          </span>
        </div>
      </div>

      {change.reason && (
        <div className="flex items-start gap-2 mb-3 p-2 bg-film-secondary/50 rounded">
          <MessageSquare className="w-4 h-4 text-film-text-muted mt-0.5 flex-shrink-0" />
          <p className="text-sm text-film-text-secondary">{change.reason}</p>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <p className="text-xs text-film-text-muted mb-1">旧值：</p>
          <p className="text-sm text-film-text-secondary line-through decoration-red-500/50">
            {change.oldValue || '(空)'}
          </p>
        </div>
        <div>
          <p className="text-xs text-film-text-muted mb-1">新值：</p>
          <p className="text-sm text-film-text-primary">
            <DiffRenderer parts={diffParts} />
          </p>
        </div>
      </div>
    </div>
  );
}

interface DiffRendererProps {
  parts: Array<{
    type: 'added' | 'removed' | 'unchanged';
    value: string;
  }>;
}

function DiffRenderer({ parts }: DiffRendererProps) {
  return (
    <span>
      {parts.map((part, index) => (
        <span
          key={index}
          className={`${
            part.type === 'added'
              ? 'diff-added'
              : part.type === 'removed'
              ? 'diff-removed'
              : 'diff-unchanged'
          }`}
        >
          {part.value}
        </span>
      ))}
    </span>
  );
}

interface VersionDiffViewerProps {
  diffs: DiffResult[];
}

export function VersionDiffViewer({ diffs }: VersionDiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-film-text-muted">
        两个版本无差异
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {diffs.map((diff, index) => (
        <div key={index} className="bg-film-card border border-film-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-film-primary mb-3">
            {FIELD_LABELS[diff.fieldName] || diff.fieldName}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-film-text-muted mb-1">旧版本：</p>
              <div className="p-2 bg-film-panel rounded">
                <DiffRenderer
                  parts={diff.changes.map((c) => ({
                    ...c,
                    type: c.type === 'added' ? 'unchanged' : c.type,
                  }))}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-film-text-muted mb-1">新版本：</p>
              <div className="p-2 bg-film-panel rounded">
                <DiffRenderer
                  parts={diff.changes.map((c) => ({
                    ...c,
                    type: c.type === 'removed' ? 'unchanged' : c.type,
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
