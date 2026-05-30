import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Clock,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  GitCompare,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { formatDate } from '@/utils/helpers';
import { MATERIAL_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

export const HistoryPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { getProjectSnapshots, getSnapshotIssues, getProjectLogs, setCurrentProject, setCurrentSnapshot } = useAppStore();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);

  React.useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);

  const snapshots = projectId ? getProjectSnapshots(projectId) : [];
  const logs = projectId ? getProjectLogs(projectId) : [];

  const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId);
  const compareSnapshot = snapshots.find(s => s.id === compareSnapshotId);

  const selectedIssues = selectedSnapshotId ? getSnapshotIssues(selectedSnapshotId) : [];
  const compareIssues = compareSnapshotId ? getSnapshotIssues(compareSnapshotId) : [];

  const handleSelectSnapshot = (snapshotId: string) => {
    if (selectedSnapshotId === snapshotId) {
      setSelectedSnapshotId(null);
      setCompareSnapshotId(null);
    } else if (compareSnapshotId === snapshotId) {
      setCompareSnapshotId(null);
    } else if (!selectedSnapshotId) {
      setSelectedSnapshotId(snapshotId);
    } else if (!compareSnapshotId) {
      setCompareSnapshotId(snapshotId);
    } else {
      setSelectedSnapshotId(snapshotId);
      setCompareSnapshotId(null);
    }
  };

  const getIssueCount = (snapshotId: string, severity: 'error' | 'warning') => {
    return getSnapshotIssues(snapshotId).filter(i => i.severity === severity && !i.resolved).length;
  };

  const getDiffSummary = () => {
    if (!selectedSnapshot || !compareSnapshot) return null;

    const selectedErrors = selectedIssues.filter(i => i.severity === 'error').length;
    const compareErrors = compareIssues.filter(i => i.severity === 'error').length;
    const selectedWarnings = selectedIssues.filter(i => i.severity === 'warning').length;
    const compareWarnings = compareIssues.filter(i => i.severity === 'warning').length;

    return {
      errorDiff: selectedErrors - compareErrors,
      warningDiff: selectedWarnings - compareWarnings,
      alignmentDiff: selectedSnapshot.alignmentPassRate - compareSnapshot.alignmentPassRate,
    };
  };

  const diff = getDiffSummary();

  return (
    <div className="min-h-full p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">历史回看</h2>
          <p className="text-text-muted">
            查看所有核对版本和操作记录，支持版本对比
          </p>
        </div>

        {snapshots.length === 0 && logs.length === 0 ? (
          <div className="card text-center py-16">
            <Clock className="mx-auto text-text-muted mb-4" size={48} />
            <h3 className="text-lg font-medium mb-2">暂无历史记录</h3>
            <p className="text-text-muted">执行第一次核对后将显示历史版本</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <GitCompare size={18} />
                  版本时间线
                </h3>
                {snapshots.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-8">
                    暂无核对版本
                  </p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-bg-tertiary" />
                    <div className="space-y-2">
                      {snapshots.map((snapshot, index) => {
                        const isSelected = selectedSnapshotId === snapshot.id;
                        const isCompare = compareSnapshotId === snapshot.id;
                        const errorCount = getIssueCount(snapshot.id, 'error');
                        const warningCount = getIssueCount(snapshot.id, 'warning');

                        return (
                          <div
                            key={snapshot.id}
                            onClick={() => handleSelectSnapshot(snapshot.id)}
                            className={cn(
                              'relative pl-10 pr-3 py-3 rounded-lg cursor-pointer transition-all',
                              isSelected && 'bg-accent-success/10 border border-accent-success/30',
                              isCompare && 'bg-accent-warning/10 border border-accent-warning/30',
                              !isSelected && !isCompare && 'hover:bg-bg-tertiary'
                            )}
                          >
                            <div
                              className={cn(
                                'absolute left-2 top-4 w-4 h-4 rounded-full border-2 bg-bg-secondary',
                                errorCount > 0 ? 'border-accent-error' : warningCount > 0 ? 'border-accent-warning' : 'border-accent-success'
                              )}
                            />
                            {(isSelected || isCompare) && (
                              <div
                                className={cn(
                                  'absolute left-2.5 top-4.5 w-3 h-3 rounded-full',
                                  isSelected ? 'bg-accent-success' : 'bg-accent-warning'
                                )}
                              />
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium timecode">v{snapshot.versionNumber}</span>
                              {(isSelected || isCompare) && (
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded',
                                  isSelected ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-warning/20 text-accent-warning'
                                )}>
                                  {isSelected ? '基准' : '对比'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted mb-2">
                              {formatDate(snapshot.createdAt)}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              {errorCount > 0 && (
                                <span className="text-accent-error flex items-center gap-1">
                                  <AlertCircle size={12} />
                                  {errorCount}
                                </span>
                              )}
                              {warningCount > 0 && (
                                <span className="text-accent-warning flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  {warningCount}
                                </span>
                              )}
                              <span className="text-text-muted">
                                {snapshot.alignmentPassRate}% 对齐
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedSnapshotId && (
                  <p className="text-xs text-text-muted mt-4 pt-4 border-t border-bg-tertiary">
                    {compareSnapshotId
                      ? '点击其他版本可切换对比基准，点击当前版本可取消'
                      : '点击另一个版本进行对比'}
                  </p>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {selectedSnapshot && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText size={18} />
                      版本详情
                      <span className="text-sm font-normal text-text-muted timecode">
                        v{selectedSnapshot.versionNumber}
                      </span>
                      {compareSnapshot && (
                        <>
                          <ChevronRight size={16} className="text-text-muted" />
                          <span className="text-sm font-normal text-text-muted timecode">
                            vs v{compareSnapshot.versionNumber}
                          </span>
                        </>
                      )}
                    </h3>
                    <button
                      onClick={() => {
                        setCurrentSnapshot(selectedSnapshot.id);
                      }}
                      className="text-xs text-accent-success hover:text-accent-success/80 transition-colors"
                    >
                      查看此版本
                    </button>
                  </div>

                  {diff && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                        <p className="text-xs text-text-muted mb-1">错误变化</p>
                        <p className={cn(
                          'text-xl font-bold',
                          diff.errorDiff < 0 ? 'text-accent-success' : diff.errorDiff > 0 ? 'text-accent-error' : 'text-text-primary'
                        )}>
                          {diff.errorDiff > 0 ? '+' : ''}{diff.errorDiff}
                        </p>
                      </div>
                      <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                        <p className="text-xs text-text-muted mb-1">警告变化</p>
                        <p className={cn(
                          'text-xl font-bold',
                          diff.warningDiff < 0 ? 'text-accent-success' : diff.warningDiff > 0 ? 'text-accent-warning' : 'text-text-primary'
                        )}>
                          {diff.warningDiff > 0 ? '+' : ''}{diff.warningDiff}
                        </p>
                      </div>
                      <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                        <p className="text-xs text-text-muted mb-1">对齐率变化</p>
                        <p className={cn(
                          'text-xl font-bold',
                          diff.alignmentDiff > 0 ? 'text-accent-success' : diff.alignmentDiff < 0 ? 'text-accent-error' : 'text-text-primary'
                        )}>
                          {diff.alignmentDiff > 0 ? '+' : ''}{diff.alignmentDiff}%
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-text-muted">使用材料</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedSnapshot.materials.map(mat => (
                        <div key={mat.materialId} className="bg-bg-tertiary rounded p-2 flex items-center justify-between text-sm">
                          <span>{MATERIAL_TYPE_LABELS[mat.type]}</span>
                          <span className="text-xs font-mono text-text-muted truncate max-w-[150px]">
                            {mat.fileName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User size={18} />
                  操作日志
                </h3>
                {logs.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-8">
                    暂无操作记录
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                    {logs.map(log => (
                      <div
                        key={log.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg',
                          log.isError ? 'bg-accent-error/10' : 'bg-bg-tertiary'
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          log.isError ? 'bg-accent-error/20' : 'bg-bg-secondary'
                        )}>
                          {log.isError ? (
                            <AlertCircle className="text-accent-error" size={16} />
                          ) : (
                            <CheckCircle2 className="text-accent-success" size={16} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{log.action}</span>
                            <span className="text-xs text-text-muted">
                              {formatDate(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-text-muted truncate">{log.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
