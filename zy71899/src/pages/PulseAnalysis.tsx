import React, { useEffect, useState } from 'react';
import {
  Play,
  History,
  Download,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useUIStore } from '@/stores/uiStore';
import { PressureWaveform } from '@/components/PressureWaveform';
import { ConclusionCard } from '@/components/ConclusionCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/utils/helpers';
import { generateInspectionReport, downloadReport } from '@/utils/reportGenerator';

export const PulseAnalysis: React.FC = () => {
  const location = useLocation();
  const initialBatchId = (location.state as { batchId?: string })?.batchId;

  const {
    batches,
    analysisRuns,
    currentRun,
    currentConclusions,
    loading,
    loadBatches,
    loadAnalysisRuns,
    runPulseAnalysis,
    selectAnalysisRun,
  } = useAnalysisStore();

  const { currentUser } = useUIStore();

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId || null);
  const [showVersionSelect, setShowVersionSelect] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches]);

  useEffect(() => {
    if (selectedBatchId) {
      loadAnalysisRuns(selectedBatchId);
    }
  }, [selectedBatchId]);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const handleRunAnalysis = async () => {
    if (!selectedBatchId || !currentUser) return;

    setIsAnalyzing(true);
    try {
      await runPulseAnalysis(selectedBatchId, currentUser);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportReport = async () => {
    if (!currentRun || !selectedBatch) return;

    const report = generateInspectionReport(
      selectedBatch,
      currentRun,
      currentConclusions
    );
    downloadReport(report);
  };

  const dangerCount = currentConclusions.filter((c) => c.thresholdLevel === 'danger').length;
  const warningCount = currentConclusions.filter((c) => c.thresholdLevel === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-text">管线压力脉冲</h1>
          <p className="text-industrial-text-muted mt-1">
            整合多源数据，自动检测阈值跨档
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVersionSelect(!showVersionSelect)}
            className="btn-secondary flex items-center gap-2"
            disabled={analysisRuns.length === 0}
          >
            <History className="w-4 h-4" />
            历史版本
            <ChevronDown className={`w-4 h-4 transition-transform ${showVersionSelect ? 'rotate-180' : ''}`} />
          </button>

          {currentRun && (
            <button
              onClick={handleExportReport}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
          )}

          <button
            onClick={handleRunAnalysis}
            disabled={!selectedBatchId || isAnalyzing}
            className="btn-primary flex items-center gap-2"
          >
            {isAnalyzing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isAnalyzing ? '分析中...' : '开始分析'}
          </button>
        </div>
      </div>

      <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <label className="block text-xs text-industrial-text-muted mb-1">选择批次</label>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-64 px-4 py-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-industrial-text focus:border-tech-blue focus:outline-none appearance-none pr-10"
              >
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.material?.batchNo} - {batch.material?.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 bottom-2.5 w-4 h-4 text-industrial-text-dim pointer-events-none" />
            </div>

            {selectedBatch && (
              <div className="h-10 border-l border-industrial-border pl-6">
                <p className="text-xs text-industrial-text-muted">材料</p>
                <p className="text-sm font-medium text-industrial-text">
                  {selectedBatch.material?.name}
                </p>
              </div>
            )}

            {selectedBatch && (
              <div className="h-10 border-l border-industrial-border pl-6">
                <p className="text-xs text-industrial-text-muted">规格</p>
                <p className="text-sm font-medium text-industrial-text">
                  {selectedBatch.material?.spec}
                </p>
              </div>
            )}

            <div className="h-10 border-l border-industrial-border pl-6">
              <p className="text-xs text-industrial-text-muted">分析次数</p>
              <p className="text-sm font-medium text-industrial-text">
                {analysisRuns.length} 次
              </p>
            </div>
          </div>

          {currentRun && (
            <div className="flex items-center gap-4">
              <StatusBadge
                type="analysis"
                status={currentRun.status}
              />
              <div className="text-right">
                <p className="text-xs text-industrial-text-muted">当前版本</p>
                <p className="text-sm font-mono text-tech-blue">
                  v{currentRun.version}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showVersionSelect && analysisRuns.length > 0 && (
        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-industrial-text mb-3">历史分析版本</h3>
          <div className="grid grid-cols-4 gap-3">
            {analysisRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => {
                  selectAnalysisRun(run);
                  setShowVersionSelect(false);
                }}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  currentRun?.id === run.id
                    ? 'bg-tech-blue/10 border-tech-blue/50'
                    : 'bg-industrial-bg border-industrial-border hover:border-tech-blue/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-tech-blue">v{run.version}</span>
                  <StatusBadge type="analysis" status={run.status} />
                </div>
                <p className="text-xs text-industrial-text-muted">
                  {run.operator}
                </p>
                <p className="text-xs text-industrial-text-dim">
                  {formatDateTime(run.analysisTime)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tech-blue" />
        </div>
      ) : currentRun ? (
        <>
          <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-industrial-text">压力波形</h2>
                <p className="text-sm text-industrial-text-muted">
                  共 {currentRun.waveformData.length} 个采样点
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-signal-green" />
                  <span className="text-sm text-industrial-text-muted">
                    工况日志: {currentRun.sourceStats.workLogCount} 条
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-tech-blue" />
                  <span className="text-sm text-industrial-text-muted">
                    班组记录: {currentRun.sourceStats.shiftRecordCount} 条
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-alert-orange" />
                  <span className="text-sm text-industrial-text-muted">
                    维修单: {currentRun.sourceStats.maintenanceCount} 条
                  </span>
                </div>
              </div>
            </div>

            <PressureWaveform
              data={currentRun.waveformData}
              conclusions={currentConclusions}
              height={400}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-danger-red" />
                <span className="text-sm font-medium text-industrial-text">危险跨档</span>
              </div>
              <p className="text-3xl font-bold text-danger-red">{dangerCount}</p>
              <p className="text-xs text-industrial-text-muted mt-1">
                连续超过 10.0 MPa
              </p>
            </div>

            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-alert-orange" />
                <span className="text-sm font-medium text-industrial-text">警戒跨档</span>
              </div>
              <p className="text-3xl font-bold text-alert-orange">{warningCount}</p>
              <p className="text-xs text-industrial-text-muted mt-1">
                连续超过 8.0 MPa
              </p>
            </div>

            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-industrial-text-dim" />
                <span className="text-sm font-medium text-industrial-text">分析耗时</span>
              </div>
              <p className="text-3xl font-bold text-industrial-text">
                {currentRun.analysisDurationMs < 1000
                  ? `${currentRun.analysisDurationMs}ms`
                  : `${(currentRun.analysisDurationMs / 1000).toFixed(1)}s`}
              </p>
              <p className="text-xs text-industrial-text-muted mt-1">
                包含数据对齐和峰值检测
              </p>
            </div>
          </div>

          <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-industrial-text">分析结论</h2>
                <p className="text-sm text-industrial-text-muted">
                  共 {currentConclusions.length} 个结论点，点击可追溯原始记录
                </p>
              </div>
            </div>

            {currentConclusions.length === 0 ? (
              <div className="text-center py-12 text-industrial-text-muted">
                <CheckCircle className="w-12 h-12 text-signal-green mx-auto mb-3" />
                <p>本次分析未检测到阈值跨档</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {currentConclusions.map((conclusion) => (
                  <ConclusionCard key={conclusion.id} conclusion={conclusion} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-12 text-center">
          <Play className="w-16 h-16 text-industrial-text-dim mx-auto mb-4" />
          <h3 className="text-lg font-medium text-industrial-text mb-2">
            准备开始分析
          </h3>
          <p className="text-industrial-text-muted mb-6 max-w-md mx-auto">
            系统将自动整合班组记录、工况日志和维修单数据，检测压力阈值跨档并生成可追溯的分析结论
          </p>
          <button
            onClick={handleRunAnalysis}
            disabled={!selectedBatchId || isAnalyzing}
            className="btn-primary px-8"
          >
            {isAnalyzing ? '分析中...' : '开始第一次分析'}
          </button>
        </div>
      )}
    </div>
  );
};
