import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Clock,
  User,
  ChevronRight,
  Plus,
  GitCompare,
  History,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { useRecordsStore } from '@/stores/recordsStore';
import { useUIStore } from '@/stores/uiStore';
import { StatusBadge } from '@/components/StatusBadge';
import { VersionDiffView } from '@/components/VersionDiffView';
import { formatDateTime } from '@/utils/helpers';
import type { WorkLog, WorkLogVersion, VersionDiff } from '@/types';

export const WorkLogs: React.FC = () => {
  const {
    workLogs,
    loadWorkLogs,
    addWorkLogVersion,
    getWorkLogVersions,
    getVersionDiffs,
  } = useRecordsStore();
  const { currentUser, navigateToSource } = useUIStore();
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [versions, setVersions] = useState<WorkLogVersion[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);
  const [versionDiffs, setVersionDiffs] = useState<VersionDiff[]>([]);
  const [showVersionSelect, setShowVersionSelect] = useState(false);

  useEffect(() => {
    loadWorkLogs();
  }, []);

  useEffect(() => {
    if (selectedLog) {
      getWorkLogVersions(selectedLog.id).then(setVersions);
    }
  }, [selectedLog]);

  const handleViewSource = (log: WorkLog, line: number = 1) => {
    navigateToSource({
      sourceType: 'work_log',
      sourceId: log.id,
      sourceVersion: log.currentVersion,
      sourceLine: line,
    });
  };

  const handleUploadVersion = async () => {
    if (!selectedLog || !currentUser) return;

    const newContent = `TIME,EVENT,PRESSURE_MPA
2024-01-15 08:15:00,设备启动,5.2
2024-01-15 08:30:00,压力检测,7.8
2024-01-15 09:45:00,压力波动,9.2
2024-01-15 10:20:00,压力恢复,6.5
2024-01-15 11:00:00,异常报警,10.5
2024-01-15 11:15:00,紧急处理,8.3
2024-01-15 12:00:00,正常运行,6.0`;

    try {
      await addWorkLogVersion(
        selectedLog.id,
        newContent,
        currentUser.name,
        '补传旧版本数据'
      );
      if (selectedLog) {
        getWorkLogVersions(selectedLog.id).then(setVersions);
      }
    } catch (error) {
      console.error('Failed to add version:', error);
    }
  };

  const handleShowDiff = async (v1: number, v2: number) => {
    if (!selectedLog) return;
    try {
      const diffs = await getVersionDiffs(selectedLog.id, v1, v2);
      setVersionDiffs(diffs);
      setCompareVersions([v1, v2]);
      setShowDiff(true);
    } catch (error) {
      console.error('Failed to get version diffs:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-text">工况日志</h1>
          <p className="text-industrial-text-muted mt-1">
            设备运行状态和压力数据记录
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建日志
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {workLogs.length === 0 ? (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-12 text-center">
              <ClipboardList className="w-12 h-12 text-industrial-text-dim mx-auto mb-3" />
              <p className="text-industrial-text-muted">暂无工况日志</p>
            </div>
          ) : (
            workLogs.map((log) => (
              <div
                key={log.id}
                className={`bg-industrial-bg-light border rounded-lg p-5 cursor-pointer transition-colors ${
                  selectedLog?.id === log.id
                    ? 'border-tech-blue'
                    : 'border-industrial-border hover:border-tech-blue/50'
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-data-purple/20 text-data-purple text-xs rounded font-mono">
                      v{log.currentVersion}
                    </span>
                    <span className="text-sm text-industrial-text-muted">
                      {log.equipmentId}
                    </span>
                    {log.hasDataChange && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-alert-orange/20 text-alert-orange text-xs rounded">
                        <AlertTriangle className="w-3 h-3" />
                        数据变更
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                        setShowVersionSelect(!showVersionSelect);
                      }}
                      className="p-1.5 hover:bg-industrial-bg rounded transition-colors text-industrial-text-muted hover:text-data-purple"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSource(log);
                      }}
                      className="p-1.5 hover:bg-industrial-bg rounded transition-colors text-industrial-text-muted hover:text-tech-blue"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-industrial-text mb-3">
                  {log.description || '设备运行工况记录'}
                </p>

                <div className="flex items-center gap-4 text-sm text-industrial-text-muted">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {log.operator}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDateTime(log.startTime)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          {selectedLog ? (
            <>
              <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-industrial-text">日志详情</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleUploadVersion}
                      className="p-1.5 hover:bg-industrial-bg rounded transition-colors text-industrial-text-muted hover:text-signal-green"
                      title="补传旧版本"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowVersionSelect(!showVersionSelect)}
                      className="p-1.5 hover:bg-industrial-bg rounded transition-colors text-industrial-text-muted hover:text-data-purple"
                      title="版本历史"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-industrial-text-muted mb-1">设备 ID</p>
                    <p className="text-sm font-mono text-industrial-text">{selectedLog.equipmentId}</p>
                  </div>

                  <div>
                    <p className="text-xs text-industrial-text-muted mb-1">当前版本</p>
                    <p className="text-sm text-industrial-text">
                      v{selectedLog.currentVersion}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-industrial-text-muted mb-1">操作员</p>
                    <p className="text-sm text-industrial-text">{selectedLog.operator}</p>
                  </div>

                  <div>
                    <p className="text-xs text-industrial-text-muted mb-1">时间范围</p>
                    <p className="text-sm text-industrial-text">
                      {formatDateTime(selectedLog.startTime)} -{' '}
                      {selectedLog.endTime ? formatDateTime(selectedLog.endTime) : '进行中'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-industrial-text-muted mb-1">日志内容</p>
                    <div className="bg-industrial-bg rounded-lg p-3 font-mono text-xs overflow-x-auto">
                      {selectedLog.content.split('\n').map((line, idx) => (
                        <div key={idx} className="flex gap-3">
                          <span className="text-industrial-text-dim select-none w-8 text-right">
                            {idx + 1}
                          </span>
                          <span className="text-industrial-text">{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedLog.hasDataChange && (
                    <div className="p-3 bg-alert-orange/10 border border-alert-orange/30 rounded-lg">
                      <p className="text-xs text-alert-orange font-medium mb-1">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        数据变更提醒
                      </p>
                      <p className="text-xs text-industrial-text-muted">
                        该日志已有补传版本，可能影响之前的分析结论
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => handleViewSource(selectedLog)}
                    className="w-full btn-secondary text-sm"
                  >
                    追溯原始记录
                  </button>
                </div>
              </div>

              {showVersionSelect && (
                <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-industrial-text">版本历史</h4>
                    {versions.length >= 2 && (
                      <button
                        onClick={() => handleShowDiff(1, selectedLog.currentVersion)}
                        className="text-xs text-tech-blue hover:underline flex items-center gap-1"
                      >
                        <GitCompare className="w-3 h-3" />
                        对比 v1 与 v{selectedLog.currentVersion}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {versions.map((version) => (
                      <div
                        key={version.version}
                        className="p-3 bg-industrial-bg rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-tech-blue">v{version.version}</span>
                          {version.version === selectedLog.currentVersion && (
                            <StatusBadge type="custom" label="当前版本" className="bg-signal-green/20 text-signal-green" />
                          )}
                        </div>
                        <p className="text-xs text-industrial-text-muted">
                          {version.operator} · {formatDateTime(version.timestamp)}
                        </p>
                        {version.changeDescription && (
                          <p className="text-xs text-industrial-text-dim mt-1">
                            {version.changeDescription}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-8 text-center sticky top-6">
              <ClipboardList className="w-10 h-10 text-industrial-text-dim mx-auto mb-3" />
              <p className="text-industrial-text-muted text-sm">
                选择左侧日志查看详情
              </p>
            </div>
          )}
        </div>
      </div>

      {showDiff && compareVersions && selectedLog && (
        <VersionDiffView
          diffs={versionDiffs}
          workLogId={selectedLog.id}
          oldVersion={compareVersions[0]}
          newVersion={compareVersions[1]}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
};
