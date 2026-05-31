import React, { useEffect, useState } from 'react';
import {
  History,
  ChevronRight,
  Clock,
  User,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  GitCompare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '@/stores/analysisStore';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/utils/helpers';
import type { Batch, AnalysisRun } from '@/types';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { batches, analysisRuns, loadBatches, loadAnalysisRuns } = useAnalysisStore();
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadAnalysisRuns(selectedBatch.id);
    }
  }, [selectedBatch]);

  const handleSelectRun = (run: AnalysisRun) => {
    setSelectedRun(run);
  };

  const handleViewAnalysis = (run: AnalysisRun) => {
    navigate('/pulse-analysis', {
      state: { batchId: selectedBatch?.id, runId: run.id },
    });
  };

  const handleCompareVersions = (run1: AnalysisRun, run2: AnalysisRun) => {
    console.log('Compare:', run1.version, run2.version);
  };

  const getRunStats = (run: AnalysisRun) => {
    const dangerCount = run.conclusions.filter(
      (c) => c.thresholdLevel === 'danger'
    ).length;
    const warningCount = run.conclusions.filter(
      (c) => c.thresholdLevel === 'warning'
    ).length;
    return { dangerCount, warningCount };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-text">历史追溯</h1>
          <p className="text-industrial-text-muted mt-1">
            查看所有批次的历史分析记录，支持版本对比
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-industrial-text mb-4">批次列表</h3>

          {batches.length === 0 ? (
            <div className="text-center py-8 text-industrial-text-muted">
              暂无批次数据
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => {
                    setSelectedBatch(batch);
                    setSelectedRun(null);
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedBatch?.id === batch.id
                      ? 'bg-tech-blue/10 border border-tech-blue/50'
                      : 'bg-industrial-bg border border-transparent hover:border-tech-blue/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-tech-blue text-sm">
                      {batch.material?.batchNo}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        batch.status === 'active'
                          ? 'bg-signal-green/20 text-signal-green'
                          : batch.status === 'completed'
                          ? 'bg-tech-blue/20 text-tech-blue'
                          : 'bg-industrial-text-dim/20 text-industrial-text-muted'
                      }`}
                    >
                      {batch.status === 'active'
                        ? '进行中'
                        : batch.status === 'completed'
                        ? '已完成'
                        : '已归档'}
                    </span>
                  </div>
                  <p className="text-sm text-industrial-text truncate">
                    {batch.material?.name}
                  </p>
                  <p className="text-xs text-industrial-text-dim">
                    {batch.material?.spec}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-industrial-text">分析版本</h3>
            {analysisRuns.length >= 2 && (
              <button
                onClick={() => handleCompareVersions(analysisRuns[0], analysisRuns[analysisRuns.length - 1])}
                className="text-xs text-tech-blue hover:underline flex items-center gap-1"
              >
                <GitCompare className="w-3 h-3" />
                对比版本
              </button>
            )}
          </div>

          {!selectedBatch ? (
            <div className="text-center py-8 text-industrial-text-muted">
              请先选择批次
            </div>
          ) : analysisRuns.length === 0 ? (
            <div className="text-center py-8 text-industrial-text-muted">
              该批次暂无分析记录
            </div>
          ) : (
            <div className="space-y-2">
              {analysisRuns.map((run) => {
                const stats = getRunStats(run);
                return (
                  <button
                    key={run.id}
                    onClick={() => handleSelectRun(run)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedRun?.id === run.id
                        ? 'bg-tech-blue/10 border border-tech-blue/50'
                        : 'bg-industrial-bg border border-transparent hover:border-tech-blue/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-tech-blue">v{run.version}</span>
                        <StatusBadge type="analysis" status={run.status} />
                      </div>
                      <ChevronRight className="w-4 h-4 text-industrial-text-dim" />
                    </div>

                    <div className="flex items-center gap-3 text-xs mb-2">
                      {stats.dangerCount > 0 ? (
                        <span className="flex items-center gap-1 text-danger-red">
                          <AlertTriangle className="w-3 h-3" />
                          {stats.dangerCount}
                        </span>
                      ) : stats.warningCount > 0 ? (
                        <span className="flex items-center gap-1 text-alert-orange">
                          <AlertTriangle className="w-3 h-3" />
                          {stats.warningCount}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-signal-green">
                          <CheckCircle className="w-3 h-3" />
                          正常
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-industrial-text-muted">
                      <User className="w-3 h-3" />
                      {run.operator}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-industrial-text-dim mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(run.analysisTime)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-industrial-text mb-4">版本详情</h3>

          {!selectedRun ? (
            <div className="text-center py-8 text-industrial-text-muted">
              请选择分析版本
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-industrial-text-muted">版本</span>
                <span className="font-mono text-tech-blue">v{selectedRun.version}</span>
              </div>

              <div>
                <p className="text-xs text-industrial-text-muted mb-1">操作员</p>
                <p className="text-sm text-industrial-text">{selectedRun.operator}</p>
              </div>

              <div>
                <p className="text-xs text-industrial-text-muted mb-1">分析时间</p>
                <p className="text-sm text-industrial-text">
                  {formatDateTime(selectedRun.analysisTime)}
                </p>
              </div>

              <div>
                <p className="text-xs text-industrial-text-muted mb-1">分析状态</p>
                <StatusBadge type="analysis" status={selectedRun.status} />
              </div>

              <div className="pt-3 border-t border-industrial-border">
                <p className="text-xs text-industrial-text-muted mb-3">数据来源统计</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-industrial-text-muted">工况日志</span>
                    <span className="text-industrial-text font-mono">
                      {selectedRun.sourceStats.workLogCount} 条
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-industrial-text-muted">班组记录</span>
                    <span className="text-industrial-text font-mono">
                      {selectedRun.sourceStats.shiftRecordCount} 条
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-industrial-text-muted">维修单</span>
                    <span className="text-industrial-text font-mono">
                      {selectedRun.sourceStats.maintenanceCount} 条
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-industrial-text-muted">采样点数</span>
                    <span className="text-industrial-text font-mono">
                      {selectedRun.waveformData.length} 个
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-industrial-border">
                <p className="text-xs text-industrial-text-muted mb-3">分析结果</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-industrial-bg rounded-lg">
                    <p className="text-xs text-industrial-text-muted mb-1">结论点数</p>
                    <p className="text-xl font-bold text-industrial-text">
                      {selectedRun.conclusions.length}
                    </p>
                  </div>
                  <div className="p-3 bg-industrial-bg rounded-lg">
                    <p className="text-xs text-industrial-text-muted mb-1">分析耗时</p>
                    <p className="text-lg font-bold text-industrial-text">
                      {selectedRun.analysisDurationMs < 1000
                        ? `${selectedRun.analysisDurationMs}ms`
                        : `${(selectedRun.analysisDurationMs / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="p-3 bg-danger-red/10 rounded-lg">
                    <p className="text-xs text-danger-red mb-1">危险跨档</p>
                    <p className="text-xl font-bold text-danger-red">
                      {getRunStats(selectedRun).dangerCount}
                    </p>
                  </div>
                  <div className="p-3 bg-alert-orange/10 rounded-lg">
                    <p className="text-xs text-alert-orange mb-1">警戒跨档</p>
                    <p className="text-xl font-bold text-alert-orange">
                      {getRunStats(selectedRun).warningCount}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleViewAnalysis(selectedRun)}
                className="w-full btn-primary text-sm"
              >
                查看详细分析
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
