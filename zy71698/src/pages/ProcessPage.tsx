import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, RefreshCw, FileText, CheckCircle2, AlertTriangle, Hash } from 'lucide-react';
import { useAppStore } from '@/store';
import { TimelineView } from '@/components/TimelineView';
import { IssueList } from '@/components/IssueList';
import { StatusBadge } from '@/components/StatusBadge';
import { MATERIAL_TYPE_LABELS } from '@/types';
import { formatDate } from '@/utils/helpers';
import { cn } from '@/lib/utils';

export const ProcessPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const {
    getProjectMaterials,
    getProjectSnapshots,
    getSnapshotIssues,
    getSnapshotAlignments,
    runCheck,
    resolveIssue,
    isLoading,
    currentSnapshotId,
    setCurrentSnapshot,
    setCurrentProject,
  } = useAppStore();

  const [highlightedTimecode, setHighlightedTimecode] = useState<number | null>(null);

  React.useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);

  const materials = projectId ? getProjectMaterials(projectId) : [];
  const snapshots = projectId ? getProjectSnapshots(projectId) : [];
  const activeSnapshotId = currentSnapshotId || snapshots[0]?.id;
  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId);
  const issues = activeSnapshotId ? getSnapshotIssues(activeSnapshotId) : [];
  const alignments = activeSnapshotId ? getSnapshotAlignments(activeSnapshotId) : [];

  const hasAnyParsed = materials.some(m => m.parseStatus === 'success');
  const unresolvedErrors = issues.filter(i => i.severity === 'error' && !i.resolved).length;
  const unresolvedWarnings = issues.filter(i => i.severity === 'warning' && !i.resolved).length;

  const handleRunCheck = async () => {
    if (!projectId) return;
    await runCheck(projectId);
  };

  const handleTimecodeClick = (timecode: number) => {
    setHighlightedTimecode(timecode);
    setTimeout(() => setHighlightedTimecode(null), 3000);
  };

  const handleGoToReport = () => {
    if (!projectId) return;
    navigate(`/project/${projectId}/report`);
  };

  return (
    <div className="min-h-full p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">核对处理</h2>
            <p className="text-text-muted">
              自动检测时间码错位、版本冲突和对白音乐重叠问题
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRunCheck}
              disabled={!hasAnyParsed || isLoading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              {activeSnapshot ? '重新核对' : '执行核对'}
            </button>
            <button
              onClick={handleGoToReport}
              disabled={!activeSnapshot}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <FileText size={16} />
              查看报告
            </button>
          </div>
        </div>

        {activeSnapshot && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-muted">核对版本</span>
                <Hash size={18} className="text-text-muted" />
              </div>
              <p className="text-2xl font-bold timecode">v{activeSnapshot.versionNumber}</p>
              <p className="text-xs text-text-muted mt-1">{formatDate(activeSnapshot.createdAt)}</p>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-muted">对齐通过率</span>
                <CheckCircle2 size={18} className="text-accent-success" />
              </div>
              <p className="text-2xl font-bold">{activeSnapshot.alignmentPassRate}%</p>
              <p className="text-xs text-text-muted mt-1">{alignments.filter(a => a.isAligned).length} / {alignments.length} 对齐</p>
            </div>
            <div className={cn(
              'card',
              unresolvedErrors > 0 ? 'border-accent-error/50' : ''
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-muted">错误</span>
                <AlertTriangle size={18} className="text-accent-error" />
              </div>
              <p className={cn('text-2xl font-bold', unresolvedErrors > 0 ? 'text-accent-error' : '')}>
                {activeSnapshot.errorCount}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {unresolvedErrors} 个待处理
              </p>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-muted">警告</span>
                <AlertTriangle size={18} className="text-accent-warning" />
              </div>
              <p className="text-2xl font-bold text-accent-warning">{activeSnapshot.warningCount}</p>
              <p className="text-xs text-text-muted mt-1">
                {unresolvedWarnings} 个待处理
              </p>
            </div>
          </div>
        )}

        {activeSnapshot && snapshots.length > 1 && (
          <div className="card mb-6">
            <h3 className="text-sm font-medium mb-3 text-text-muted">历史版本</h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
              {snapshots.map(snapshot => (
                <button
                  key={snapshot.id}
                  onClick={() => setCurrentSnapshot(snapshot.id)}
                  className={cn(
                    'flex-shrink-0 px-4 py-2 rounded text-sm transition-colors',
                    snapshot.id === activeSnapshotId
                      ? 'bg-accent-success text-white'
                      : 'bg-bg-tertiary hover:bg-bg-secondary'
                  )}
                >
                  v{snapshot.versionNumber} · {formatDate(snapshot.createdAt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSnapshot && (
          <div className="space-y-6">
            <TimelineView
              materials={materials}
              alignments={alignments}
              issues={issues.filter(i => !i.resolved)}
              onTimecodeClick={handleTimecodeClick}
              highlightedTimecode={highlightedTimecode}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <IssueList
                  issues={issues}
                  onResolve={resolveIssue}
                  onTimecodeClick={handleTimecodeClick}
                />
              </div>

              <div className="space-y-4">
                <div className="card">
                  <h3 className="font-semibold mb-3">版本校验</h3>
                  <div className="space-y-3">
                    {activeSnapshot.materials.map(mat => {
                      const actualMaterial = materials.find(m => m.id === mat.materialId);
                      return (
                        <div key={mat.materialId} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={actualMaterial?.parseStatus || 'pending'} />
                            <span className="text-text-muted">{MATERIAL_TYPE_LABELS[mat.type]}</span>
                          </div>
                          <span className="text-xs font-mono text-text-muted">
                            {mat.fingerprint.substring(0, 8)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-text-muted mt-3 pt-3 border-t border-bg-tertiary">
                    指纹用于检测材料是否被修改，如指纹变化说明材料已更新
                  </p>
                </div>

                <div className="card">
                  <h3 className="font-semibold mb-3">核对摘要</h3>
                  <p className="text-sm text-text-primary mb-4">{activeSnapshot.summary}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">参与材料</span>
                      <span>{activeSnapshot.materials.length} 份</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">对齐点数</span>
                      <span>{alignments.length} 个</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">对齐通过</span>
                      <span className="text-accent-success">
                        {alignments.filter(a => a.isAligned).length} 个
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!activeSnapshot && hasAnyParsed && (
          <div className="card text-center py-16">
            <Play className="mx-auto text-text-muted mb-4" size={48} />
            <h3 className="text-lg font-medium mb-2">准备就绪</h3>
            <p className="text-text-muted mb-6">已上传 {materials.length} 份材料，点击下方按钮开始核对</p>
            <button
              onClick={handleRunCheck}
              disabled={isLoading}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
              执行Cue点核对
            </button>
          </div>
        )}

        {!hasAnyParsed && (
          <div className="card text-center py-16">
            <AlertTriangle className="mx-auto text-accent-warning mb-4" size={48} />
            <h3 className="text-lg font-medium mb-2">没有可用于核对的材料</h3>
            <p className="text-text-muted mb-6">请先上传并解析至少一份材料</p>
            <button
              onClick={() => navigate(`/project/${projectId}/upload`)}
              className="btn-primary"
            >
              前往上传材料
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
