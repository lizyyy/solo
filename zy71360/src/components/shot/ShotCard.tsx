import { Link } from 'react-router-dom';
import { Clock, Edit3, History, Lock, Unlock } from 'lucide-react';
import type { Shot } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { VersionTag } from '@/components/common/VersionTag';
import { formatDate, formatTimecode } from '@/utils/version';
import { mockUsers } from '@/data/mockData';
import { canEdit, canLock, canUnlock } from '@/utils/validation';
import { useShotStore } from '@/store/useShotStore';

interface ShotCardProps {
  shot: Shot;
}

export function ShotCard({ shot }: ShotCardProps) {
  const { currentUser, lockShot, unlockShot } = useShotStore();
  const currentVersion = shot.versions.find((v) => v.id === shot.currentVersionId);
  const creator = currentVersion ? mockUsers.find((u) => u.id === currentVersion.createdBy) : null;

  const handleLock = () => {
    if (canLock(shot, currentUser.role)) {
      const reason = prompt('请输入锁定理由：', '导演审定通过');
      if (reason) {
        lockShot(shot.id, reason);
      }
    }
  };

  const handleUnlock = () => {
    if (canUnlock(shot, currentUser.role)) {
      const reason = prompt('请输入解锁理由：', '需要修改分镜');
      if (reason) {
        unlockShot(shot.id, reason);
      }
    }
  };

  if (!currentVersion) return null;

  return (
    <div className="bg-film-card border border-film-border rounded-xl overflow-hidden hover:border-film-primary/50 transition-all group">
      <Link to={`/shot/${shot.id}`} className="block">
        <div className="relative aspect-video overflow-hidden bg-film-panel">
          {currentVersion.storyboardImage ? (
            <img
              src={currentVersion.storyboardImage}
              alt={currentVersion.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-film-text-muted">
              <span className="text-4xl">🎬</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="timecode font-mono">{formatTimecode(currentVersion.duration)}</span>
          </div>
          <div className="absolute top-3 right-3">
            <StatusBadge status={shot.status} size="sm" />
          </div>
          {shot.status === 'locked' && (
            <div className="absolute inset-0 bg-film-danger/10 border-2 border-film-danger/30 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <Lock className="w-12 h-12 text-film-danger/50" />
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-film-primary font-bold">
                {shot.shotNumber}
              </span>
              <VersionTag
                version={currentVersion.version}
                isRollback={!!currentVersion.rollbackFromVersionId}
                size="sm"
              />
            </div>
            <Link
              to={`/shot/${shot.id}`}
              className="text-base font-semibold text-film-text-primary hover:text-film-primary transition-colors line-clamp-1"
            >
              {currentVersion.title}
            </Link>
          </div>
        </div>

        {currentVersion.dialogue && (
          <p className="text-sm text-film-text-secondary line-clamp-2 mb-3 italic">
            "{currentVersion.dialogue.substring(0, 50)}..."
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-film-border">
          <div className="flex items-center gap-2 text-xs text-film-text-muted">
            <Clock className="w-3 h-3" />
            <span>{formatDate(currentVersion.createdAt)}</span>
            {creator && <span>· {creator.avatar} {creator.name}</span>}
          </div>

          <div className="flex items-center gap-1">
            <Link
              to={`/shot/${shot.id}/history`}
              className="p-2 text-film-text-muted hover:text-film-text-primary hover:bg-film-panel rounded-lg transition-colors"
              title="版本历史"
            >
              <History className="w-4 h-4" />
            </Link>

            {canLock(shot, currentUser.role) && (
              <button
                onClick={handleLock}
                className="p-2 text-film-text-muted hover:text-film-danger hover:bg-film-panel rounded-lg transition-colors"
                title="锁定版本"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

            {canUnlock(shot, currentUser.role) && (
              <button
                onClick={handleUnlock}
                className="p-2 text-film-text-muted hover:text-film-success hover:bg-film-panel rounded-lg transition-colors"
                title="解锁版本"
              >
                <Unlock className="w-4 h-4" />
              </button>
            )}

            {canEdit(shot, currentUser.role) && (
              <Link
                to={`/shot/${shot.id}/edit`}
                className="p-2 text-film-text-muted hover:text-film-primary hover:bg-film-panel rounded-lg transition-colors"
                title="编辑"
              >
                <Edit3 className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {shot.versions.length > 1 && (
          <div className="mt-2 text-xs text-film-text-muted">
            共 {shot.versions.length} 个版本
          </div>
        )}
      </div>
    </div>
  );
}
