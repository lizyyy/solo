import { Link } from 'react-router-dom';
import { Film, RotateCcw, Lock, User, Clock } from 'lucide-react';
import type { Shot, ShotVersion } from '@/types';
import { VersionTag } from '@/components/common/VersionTag';
import { formatDate } from '@/utils/version';
import { mockUsers } from '@/data/mockData';

interface VersionTimelineProps {
  shot: Shot;
  selectedVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
}

export function VersionTimeline({ shot, selectedVersionId, onSelectVersion }: VersionTimelineProps) {
  const sortedVersions = [...shot.versions].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className="space-y-3">
      {sortedVersions.map((version, index) => (
        <VersionNode
          key={version.id}
          version={version}
          isCurrent={version.id === shot.currentVersionId}
          isSelected={version.id === selectedVersionId}
          isLatest={index === 0}
          isLocked={shot.status === 'locked' && version.id === shot.currentVersionId}
          onClick={() => onSelectVersion?.(version.id)}
        />
      ))}
    </div>
  );
}

interface VersionNodeProps {
  version: ShotVersion;
  isCurrent: boolean;
  isSelected: boolean;
  isLatest: boolean;
  isLocked: boolean;
  onClick?: () => void;
}

function VersionNode({ version, isCurrent, isSelected, isLatest, isLocked, onClick }: VersionNodeProps) {
  const creator = mockUsers.find((u) => u.id === version.createdBy);
  const isRollback = !!version.rollbackFromVersionId;

  return (
    <div
      onClick={onClick}
      className={`relative pl-8 pb-4 cursor-pointer transition-all ${
        isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'
      }`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-film-border"></div>

      <div
        className={`absolute left-[-8px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          isLocked
            ? 'bg-film-danger border-film-danger'
            : isRollback
            ? 'bg-film-warning border-film-warning'
            : isCurrent
            ? 'bg-film-primary border-film-primary'
            : 'bg-film-card border-film-border'
        }`}
      >
        {isLocked ? (
          <Lock className="w-2 h-2 text-white" />
        ) : isRollback ? (
          <RotateCcw className="w-2 h-2 text-white" />
        ) : (
          <Film className="w-2 h-2 text-white" />
        )}
      </div>

      <div
        className={`p-3 rounded-lg border transition-all ${
          isSelected
            ? 'bg-film-secondary border-film-primary'
            : 'bg-film-card border-film-border hover:border-film-primary/50'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <VersionTag
            version={version.version}
            isRollback={isRollback}
            size="sm"
          />
          {isCurrent && (
            <span className="text-xs px-2 py-0.5 bg-film-primary/20 text-film-primary rounded-full">
              当前版本
            </span>
          )}
        </div>

        <h4 className="text-sm font-medium text-film-text-primary mb-1 line-clamp-1">
          {version.title}
        </h4>

        {version.changeSummary && (
          <p className="text-xs text-film-text-secondary mb-2 line-clamp-2">
            {version.changeSummary}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-film-text-muted">
          {creator && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {creator.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(version.createdAt)}
          </span>
        </div>

        {version.fieldChanges.length > 0 && (
          <div className="mt-2 pt-2 border-t border-film-border">
            <span className="text-xs text-film-text-muted">
              修改了 {version.fieldChanges.length} 个字段
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
