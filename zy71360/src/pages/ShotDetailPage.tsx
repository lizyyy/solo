import { useParams, Link } from 'react-router-dom';
import { useShotStore } from '@/store/useShotStore';
import { FilmBorder } from '@/components/common/FilmBorder';
import { StatusBadge } from '@/components/common/StatusBadge';
import { VersionTag } from '@/components/common/VersionTag';
import { LockIndicator } from '@/components/common/LockIndicator';
import { VersionTimeline } from '@/components/version/VersionTimeline';
import { FieldDiffViewer } from '@/components/version/FieldDiffViewer';
import { formatDate, formatTimecode } from '@/utils/version';
import { canEdit } from '@/utils/validation';
import {
  Edit3,
  History,
  Clock,
  User,
  MessageSquare,
  Palette,
  Sparkles,
  Link as LinkIcon,
  Image,
  Film,
  ChevronLeft,
  Lock,
  Unlock,
} from 'lucide-react';
import { mockUsers } from '@/data/mockData';
import { useState } from 'react';

export function ShotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getShotById, getCurrentVersion, currentUser, lockShot, unlockShot } = useShotStore();
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();

  const shot = id ? getShotById(id) : undefined;
  const currentVersion = id ? getCurrentVersion(id) : undefined;
  const displayVersion = selectedVersionId
    ? shot?.versions.find((v) => v.id === selectedVersionId)
    : currentVersion;

  if (!shot || !currentVersion || !displayVersion) {
    return (
      <div className="p-6">
        <p className="text-film-text-secondary">镜头不存在</p>
        <Link to="/" className="text-film-primary hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  const creator = mockUsers.find((u) => u.id === displayVersion.createdBy);
  const allFieldChanges = shot.versions.flatMap((v) => v.fieldChanges);

  const handleLock = () => {
    const reason = prompt('请输入锁定理由：', '导演审定通过');
    if (reason) lockShot(shot.id, reason);
  };

  const handleUnlock = () => {
    const reason = prompt('请输入解锁理由：', '需要修改分镜');
    if (reason) unlockShot(shot.id, reason);
  };

  return (
    <div className="min-h-screen">
      <FilmBorder>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-film-text-muted hover:text-film-text-primary hover:bg-film-card rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-lg text-film-primary font-bold">
                    {shot.shotNumber}
                  </span>
                  <StatusBadge status={shot.status} />
                  <VersionTag
                    version={displayVersion.version}
                    isRollback={!!displayVersion.rollbackFromVersionId}
                  />
                </div>
                <h2 className="text-xl font-bold text-film-text-primary">{displayVersion.title}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LockIndicator
                isLocked={shot.status === 'locked'}
                lockedBy={shot.lockedBy}
                lockedAt={shot.lockedAt}
              />
              {canEdit(shot, currentUser.role) && (
                <Link
                  to={`/shot/${shot.id}/edit`}
                  className="flex items-center gap-2 px-4 py-2 bg-film-primary hover:bg-film-primary/80 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  编辑
                </Link>
              )}
              <Link
                to={`/shot/${shot.id}/history`}
                className="flex items-center gap-2 px-4 py-2 bg-film-secondary hover:bg-film-secondary/80 text-film-text-primary rounded-lg text-sm font-medium transition-colors border border-film-border"
              >
                <History className="w-4 h-4" />
                历史
              </Link>
              {currentUser.role === 'director' && shot.status !== 'locked' && (
                <button
                  onClick={handleLock}
                  className="flex items-center gap-2 px-4 py-2 bg-film-danger hover:bg-film-danger/80 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  锁定
                </button>
              )}
              {currentUser.role === 'director' && shot.status === 'locked' && (
                <button
                  onClick={handleUnlock}
                  className="flex items-center gap-2 px-4 py-2 bg-film-success hover:bg-film-success/80 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Unlock className="w-4 h-4" />
                  解锁
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-3 text-sm text-film-text-secondary">
            {creator && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {creator.avatar} {creator.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(displayVersion.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Film className="w-4 h-4" />
              时长 {formatTimecode(displayVersion.duration)}
            </span>
            <span className="flex items-center gap-1">
              <History className="w-4 h-4" />
              {shot.versions.length} 个版本
            </span>
          </div>
        </div>
      </FilmBorder>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {displayVersion.storyboardImage && (
            <div className="bg-film-card border border-film-border rounded-xl overflow-hidden">
              <div className="aspect-video relative">
                <img
                  src={displayVersion.storyboardImage}
                  alt={displayVersion.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 right-4">
                  <span className="timecode font-mono text-lg">
                    {formatTimecode(displayVersion.duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {displayVersion.dialogue && (
            <div className="bg-film-card border border-film-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-film-primary" />
                <h3 className="text-lg font-semibold text-film-text-primary">台词</h3>
              </div>
              <div className="pl-6 border-l-4 border-film-primary/50">
                {displayVersion.dialogue.split('\n').map((line, i) => (
                  <p key={i} className="text-film-text-primary mb-2 last:mb-0">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {displayVersion.actionDescription && (
            <div className="bg-film-card border border-film-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Film className="w-5 h-5 text-film-primary" />
                <h3 className="text-lg font-semibold text-film-text-primary">动作描述</h3>
              </div>
              <p className="text-film-text-secondary leading-relaxed">
                {displayVersion.actionDescription}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayVersion.artNotes && (
              <div className="bg-film-card border border-film-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-film-primary" />
                  <h3 className="text-lg font-semibold text-film-text-primary">美术备注</h3>
                </div>
                <p className="text-film-text-secondary leading-relaxed whitespace-pre-wrap">
                  {displayVersion.artNotes}
                </p>
              </div>
            )}

            {displayVersion.vfxNotes && (
              <div className="bg-film-card border border-film-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-film-primary" />
                  <h3 className="text-lg font-semibold text-film-text-primary">特效说明</h3>
                </div>
                <p className="text-film-text-secondary leading-relaxed whitespace-pre-wrap">
                  {displayVersion.vfxNotes}
                </p>
              </div>
            )}
          </div>

          {displayVersion.referenceLinks && (
            <div className="bg-film-card border border-film-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="w-5 h-5 text-film-primary" />
                <h3 className="text-lg font-semibold text-film-text-primary">参考资料</h3>
              </div>
              <p className="text-film-text-secondary leading-relaxed whitespace-pre-wrap">
                {displayVersion.referenceLinks}
              </p>
            </div>
          )}

          {allFieldChanges.length > 0 && (
            <div className="bg-film-card border border-film-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-film-primary" />
                <h3 className="text-lg font-semibold text-film-text-primary">字段变更历史</h3>
              </div>
              <FieldDiffViewer changes={allFieldChanges} />
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="bg-film-card border border-film-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-film-text-primary mb-4">版本时间线</h3>
              <VersionTimeline
                shot={shot}
                selectedVersionId={selectedVersionId}
                onSelectVersion={(vid) =>
                  setSelectedVersionId(vid === selectedVersionId ? undefined : vid)
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
