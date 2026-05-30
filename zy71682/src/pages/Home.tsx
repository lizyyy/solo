import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Trash2, AlertTriangle, Clock, GitBranch } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { FilterPanel } from '@/components/FilterPanel';
import { StatsPanel } from '@/components/StatsPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { ConflictBadge } from '@/components/ConflictBadge';
import { VersionSelector } from '@/components/VersionSelector';
import {
  formatDateForDisplay,
  formatDateTimeForDisplay
} from '@/utils/helpers';
import { RequirementStatus } from '@/types';

export default function Home() {
  const navigate = useNavigate();
  const {
    requirements,
    versions,
    filterSnapshots,
    exportHistory,
    currentFilters,
    selectedVersion,
    lastSaved,
    isLoaded,
    initializeStore,
    getFilteredRequirements,
    setCurrentFilters,
    resetFilters,
    saveFilterSnapshot,
    deleteFilterSnapshot,
    applyFilterSnapshot,
    deleteRequirement,
    runConflictDetection,
    setSelectedVersion,
    resolveConflict
  } = useAppStore();

  const [isDetecting, setIsDetecting] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      initializeStore();
    }
  }, [isLoaded, initializeStore]);

  const filteredRequirements = getFilteredRequirements();

  const handleRunDetection = () => {
    setIsDetecting(true);
    setTimeout(() => {
      runConflictDetection();
      setIsDetecting(false);
    }, 500);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个需求吗？此操作不可撤销。')) {
      deleteRequirement(id);
    }
  };

  const getRequirementVersions = (reqId: string) => {
    return versions.filter((v) => v.requirementId === reqId);
  };

  const selectedRequirement = selectedRequirementId
    ? requirements.find((r) => r.id === selectedRequirementId)
    : null;

  const selectedRequirementVersions = selectedRequirementId
    ? getRequirementVersions(selectedRequirementId)
    : [];

  const getDisplayRequirement = (req: typeof requirements[0]) => {
    if (selectedRequirementId === req.id && selectedVersion !== null) {
      const versionRecord = versions.find(
        (v) => v.requirementId === req.id && v.versionNumber === selectedVersion
      );
      return versionRecord?.snapshot || req;
    }
    return req;
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-base-500">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold uppercase tracking-wider">
            舞台监听需求清单
          </h1>
          <p className="text-sm font-mono text-base-500 mt-1">
            共 {filteredRequirements.length} 条记录
            {Object.keys(currentFilters).length > 0 && ' (已筛选)'}
          </p>
        </div>
      </div>

      <StatsPanel
        requirements={requirements}
        exportHistory={exportHistory}
        lastSaved={lastSaved}
        onRunDetection={handleRunDetection}
        isDetecting={isDetecting}
      />

      <FilterPanel
        currentFilters={currentFilters}
        filterSnapshots={filterSnapshots}
        onFilterChange={setCurrentFilters}
        onResetFilters={resetFilters}
        onSaveSnapshot={saveFilterSnapshot}
        onDeleteSnapshot={deleteFilterSnapshot}
        onApplySnapshot={applyFilterSnapshot}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header w-12">#</th>
                    <th className="table-header">乐队名称</th>
                    <th className="table-header">演出日期</th>
                    <th className="table-header">时间</th>
                    <th className="table-header text-center">通道</th>
                    <th className="table-header text-center">返听</th>
                    <th className="table-header text-center">换场</th>
                    <th className="table-header">版本</th>
                    <th className="table-header">状态</th>
                    <th className="table-header text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="table-cell text-center py-8 text-base-500">
                        暂无符合条件的记录
                      </td>
                    </tr>
                  ) : (
                    filteredRequirements.map((req, index) => {
                      const displayReq = getDisplayRequirement(req);
                      const unresolvedConflicts = displayReq.conflicts.filter(
                        (c) => !c.resolved
                      );

                      return (
                        <tr
                          key={req.id}
                          className={`hover:bg-base-800 transition-colors cursor-pointer
                            ${selectedRequirementId === req.id ? 'bg-base-800' : ''}
                            ${selectedVersion !== null && selectedRequirementId === req.id ? 'animate-glitch' : ''}`}
                          onClick={() => {
                            setSelectedRequirementId(req.id === selectedRequirementId ? null : req.id);
                            setSelectedVersion(null);
                            setShowVersionPanel(true);
                          }}
                        >
                          <td className="table-cell text-base-500 font-mono text-xs">
                            {index + 1}
                          </td>
                          <td className="table-cell font-mono font-medium">
                            {displayReq.bandName}
                          </td>
                          <td className="table-cell font-mono text-sm">
                            {formatDateForDisplay(displayReq.performanceDate)}
                          </td>
                          <td className="table-cell font-mono text-sm">
                            {displayReq.startTime} - {displayReq.endTime}
                          </td>
                          <td className="table-cell text-center font-mono">
                            {displayReq.channels.length}
                          </td>
                          <td className="table-cell text-center font-mono">
                            {displayReq.monitors.length}
                          </td>
                          <td className="table-cell text-center font-mono">
                            {displayReq.changeOverTime}m
                          </td>
                          <td className="table-cell">
                            <span className="inline-flex items-center gap-1 font-mono text-xs">
                              <GitBranch className="w-3 h-3 text-neon-purple" />
                              v{displayReq.currentVersion}
                            </span>
                          </td>
                          <td className="table-cell">
                            <StatusBadge status={displayReq.status} showLabel={false} />
                          </td>
                          <td className="table-cell text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/requirement/${req.id}`);
                                }}
                                className="p-1.5 hover:bg-base-700 text-base-500 hover:text-white transition-colors"
                                title="查看详情"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(req.id, e)}
                                className="p-1.5 hover:bg-base-700 text-base-500 hover:text-neon-red transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRequirement && (
            <div className="panel mt-4">
              <div className="panel-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedVersion !== null ? (
                    <span className="text-neon-purple">
                      查看历史版本 v{selectedVersion}
                    </span>
                  ) : (
                    <span>{selectedRequirement.bandName} - 详细信息</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedRequirementId(null);
                    setSelectedVersion(null);
                  }}
                  className="text-xs font-mono text-base-500 hover:text-white"
                >
                  关闭
                </button>
              </div>
              <div className="p-4">
                {(() => {
                  const displayReq = getDisplayRequirement(selectedRequirement);
                  const unresolvedConflicts = displayReq.conflicts.filter((c) => !c.resolved);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-neon-cyan" />
                          基本信息
                        </h4>
                        <div className="space-y-2 text-sm font-mono">
                          <div className="flex justify-between py-1 border-b border-base-700">
                            <span className="text-base-500">演出日期</span>
                            <span>{formatDateForDisplay(displayReq.performanceDate)}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-base-700">
                            <span className="text-base-500">演出时间</span>
                            <span>
                              {displayReq.startTime} - {displayReq.endTime}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-base-700">
                            <span className="text-base-500">换场时间</span>
                            <span>{displayReq.changeOverTime} 分钟</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-base-700">
                            <span className="text-base-500">通道数</span>
                            <span>{displayReq.channels.length}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-base-700">
                            <span className="text-base-500">返听数</span>
                            <span>{displayReq.monitors.length}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-base-700">
                            <span className="text-base-500">创建时间</span>
                            <span>{formatDateTimeForDisplay(displayReq.createdAt)}</span>
                          </div>
                          <div className="py-1">
                            <span className="text-base-500 block mb-1">舞台备注</span>
                            <p className="text-white bg-base-900 p-2 border border-base-700">
                              {displayReq.stageNotes || '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-neon-orange" />
                          冲突检测结果 ({unresolvedConflicts.length})
                        </h4>
                        {unresolvedConflicts.length === 0 ? (
                          <div className="text-sm font-mono text-base-500 bg-base-900 p-4 border border-base-700 text-center">
                            暂无未解决的冲突
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {unresolvedConflicts.map((conflict) => (
                              <ConflictBadge
                                key={conflict.id}
                                conflict={conflict}
                                onResolve={() =>
                                  selectedVersion === null &&
                                  resolveConflict(selectedRequirement.id, conflict.id)
                                }
                                showResolve={selectedVersion === null}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {showVersionPanel && selectedRequirement && (
            <div className="panel">
              <div className="panel-header">版本选择</div>
              <div className="p-4">
                <VersionSelector
                  versions={selectedRequirementVersions}
                  selectedVersion={selectedRequirementId === selectedRequirement.id ? selectedVersion : null}
                  onSelectVersion={(v) => {
                    setSelectedRequirementId(selectedRequirement.id);
                    setSelectedVersion(v);
                  }}
                />
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-header">快速统计</div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-base-500">正常</span>
                <span className="font-mono text-neon-green">
                  {requirements.filter((r) => r.status === RequirementStatus.NORMAL).length}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-base-500">待处理</span>
                <span className="font-mono text-neon-orange">
                  {requirements.filter((r) => r.status === RequirementStatus.PENDING).length}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-base-500">有冲突</span>
                <span className="font-mono text-neon-red">
                  {requirements.filter((r) => r.status === RequirementStatus.CONFLICT).length}
                </span>
              </div>
            </div>
          </div>

          {exportHistory.length > 0 && (
            <div className="panel">
              <div className="panel-header">最近导出</div>
              <div className="p-4">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {exportHistory
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
                    .map((record) => (
                      <div
                        key={record.id}
                        className="text-xs font-mono p-2 bg-base-900 border border-base-700"
                      >
                        <div className="flex justify-between items-center">
                          <span className="uppercase text-neon-purple">{record.format}</span>
                          <span className="text-base-500">{record.recordCount} 条</span>
                        </div>
                        <div className="text-base-500 mt-1">
                          {formatDateTimeForDisplay(record.createdAt)}
                        </div>
                        <div className="text-neon-cyan mt-1 font-bold">
                          #{record.fileHash}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
