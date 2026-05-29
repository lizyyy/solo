import { useParams, Link, useNavigate } from 'react-router-dom';
import { useShotStore } from '@/store/useShotStore';
import { FilmBorder } from '@/components/common/FilmBorder';
import { StatusBadge } from '@/components/common/StatusBadge';
import { VersionTag } from '@/components/common/VersionTag';
import { VersionTimeline } from '@/components/version/VersionTimeline';
import { VersionDiffViewer } from '@/components/version/FieldDiffViewer';
import { formatDate } from '@/utils/version';
import { canRollback } from '@/utils/validation';
import {
  ChevronLeft,
  RotateCcw,
  ArrowRight,
  GitCompare,
  AlertTriangle,
  CheckCircle,
  X,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';

export function VersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getShotById, compareVersions, rollbackToVersion, currentUser } = useShotStore();

  const shot = id ? getShotById(id) : undefined;
  const [leftVersionId, setLeftVersionId] = useState<string | undefined>();
  const [rightVersionId, setRightVersionId] = useState<string | undefined>();
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [targetVersionId, setTargetVersionId] = useState<string | undefined>();

  if (!shot) {
    return (
      <div className="p-6">
        <p className="text-film-text-secondary">镜头不存在</p>
        <Link to="/" className="text-film-primary hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  const leftVersion = leftVersionId
    ? shot.versions.find((v) => v.id === leftVersionId)
    : undefined;
  const rightVersion = rightVersionId
    ? shot.versions.find((v) => v.id === rightVersionId)
    : undefined;

  const diffResults =
    leftVersionId && rightVersionId
      ? compareVersions(shot.id, leftVersionId, rightVersionId)
      : [];

  const handleRollback = () => {
    if (!targetVersionId || !rollbackReason.trim()) {
      alert('请填写回滚理由！');
      return;
    }

    const result = rollbackToVersion(shot.id, targetVersionId, rollbackReason);
    if (result) {
      setShowRollbackModal(false);
      setRollbackReason('');
      setTargetVersionId(undefined);
      navigate(`/shot/${shot.id}`);
    }
  };

  const openRollbackModal = (versionId: string) => {
    setTargetVersionId(versionId);
    setShowRollbackModal(true);
  };

  return (
    <div className="min-h-screen">
      <FilmBorder>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/shot/${shot.id}`}
                className="p-2 text-film-text-muted hover:text-film-text-primary hover:bg-film-card rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-lg text-film-primary font-bold">
                    {shot.shotNumber}
                  </span>
                  <StatusBadge status={shot.status} size="sm" />
                </div>
                <h2 className="text-xl font-bold text-film-text-primary">版本历史</h2>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-film-text-secondary">
              共 {shot.versions.length} 个版本
            </div>
          </div>
        </div>
      </FilmBorder>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-film-card border border-film-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-film-text-primary mb-4">版本时间线</h3>
            <p className="text-xs text-film-text-muted mb-4">
              点击版本进行对比，或点击回滚按钮恢复到历史版本
            </p>
            <VersionTimeline shot={shot} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-film-card border border-film-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <GitCompare className="w-5 h-5 text-film-primary" />
              <h3 className="text-lg font-semibold text-film-text-primary">版本对比</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-film-text-secondary mb-2">
                  旧版本
                </label>
                <select
                  value={leftVersionId || ''}
                  onChange={(e) => setLeftVersionId(e.target.value || undefined)}
                  className="w-full px-3 py-2 bg-film-panel border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary"
                >
                  <option value="">选择版本...</option>
                  {shot.versions
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} - {v.title}
                      </option>
                    ))}
                </select>
                {leftVersion && (
                  <p className="mt-1 text-xs text-film-text-muted">
                    {formatDate(leftVersion.createdAt)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-film-text-secondary mb-2">
                  新版本
                </label>
                <select
                  value={rightVersionId || ''}
                  onChange={(e) => setRightVersionId(e.target.value || undefined)}
                  className="w-full px-3 py-2 bg-film-panel border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary"
                >
                  <option value="">选择版本...</option>
                  {shot.versions
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} - {v.title}
                      </option>
                    ))}
                </select>
                {rightVersion && (
                  <p className="mt-1 text-xs text-film-text-muted">
                    {formatDate(rightVersion.createdAt)}
                  </p>
                )}
              </div>
            </div>

            {leftVersionId && rightVersionId && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <VersionTag
                    version={leftVersion?.version || ''}
                    isRollback={!!leftVersion?.rollbackFromVersionId}
                    size="sm"
                  />
                  <ArrowRight className="w-4 h-4 text-film-text-muted" />
                  <VersionTag
                    version={rightVersion?.version || ''}
                    isRollback={!!rightVersion?.rollbackFromVersionId}
                    size="sm"
                  />
                  <span className="text-film-text-muted">
                    {diffResults.length} 处差异
                  </span>
                </div>
              </div>
            )}

            {leftVersionId && rightVersionId && (
              <VersionDiffViewer diffs={diffResults} />
            )}

            {!leftVersionId || !rightVersionId ? (
              <div className="text-center py-8 text-film-text-muted">
                <GitCompare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>请选择两个版本进行对比</p>
              </div>
            ) : null}
          </div>

          <div className="bg-film-card border border-film-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="w-5 h-5 text-film-primary" />
              <h3 className="text-lg font-semibold text-film-text-primary">快速回滚</h3>
            </div>

            {canRollback(currentUser.role) ? (
              <div className="space-y-3">
                {shot.versions
                  .filter((v) => v.id !== shot.currentVersionId)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 5)
                  .map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-3 bg-film-panel rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <VersionTag
                          version={version.version}
                          isRollback={!!version.rollbackFromVersionId}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm text-film-text-primary">{version.title}</p>
                          <p className="text-xs text-film-text-muted">
                            {formatDate(version.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => openRollbackModal(version.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-film-warning/20 hover:bg-film-warning/30 text-film-warning rounded-lg text-sm font-medium transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        回滚
                      </button>
                    </div>
                  ))}

                {shot.versions.filter((v) => v.id !== shot.currentVersionId).length === 0 && (
                  <p className="text-center py-4 text-film-text-muted text-sm">
                    只有一个版本，无法回滚
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-film-text-muted">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>只有导演可以执行回滚操作</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showRollbackModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-film-card border border-film-border rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-film-text-primary flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-film-warning" />
                确认回滚
              </h3>
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  setRollbackReason('');
                  setTargetVersionId(undefined);
                }}
                className="p-1 text-film-text-muted hover:text-film-text-primary rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="p-4 bg-film-warning/10 border border-film-warning/30 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-film-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-film-warning mb-1">重要提示</p>
                    <p className="text-sm text-film-text-secondary">
                      回滚操作将创建一个新版本，不会删除任何历史记录。回滚生成的版本将被特殊标记，
                      在月度报告中单独统计。
                    </p>
                  </div>
                </div>
              </div>

              {targetVersionId && (
                <div className="mb-4">
                  <p className="text-sm text-film-text-secondary mb-2">回滚到：</p>
                  <div className="p-3 bg-film-panel rounded-lg">
                    <VersionTag
                      version={
                        shot.versions.find((v) => v.id === targetVersionId)?.version || ''
                      }
                      isRollback={
                        !!shot.versions.find((v) => v.id === targetVersionId)
                          ?.rollbackFromVersionId
                      }
                      size="sm"
                    />
                    <p className="text-sm text-film-text-primary mt-2">
                      {shot.versions.find((v) => v.id === targetVersionId)?.title}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-film-text-secondary mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  回滚理由 <span className="text-film-danger">*</span>
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="请详细说明回滚的原因..."
                  rows={4}
                  className="w-full px-4 py-3 bg-film-panel border border-film-border rounded-lg text-film-text-primary placeholder-film-text-muted focus:outline-none focus:ring-2 focus:ring-film-primary/30 focus:border-film-primary transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  setRollbackReason('');
                  setTargetVersionId(undefined);
                }}
                className="px-4 py-2 text-film-text-secondary hover:text-film-text-primary hover:bg-film-panel rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRollback}
                disabled={!rollbackReason.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-film-warning hover:bg-film-warning/80 disabled:bg-film-border disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
