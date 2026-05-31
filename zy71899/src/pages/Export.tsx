import React, { useEffect, useState } from 'react';
import {
  Download,
  FileText,
  Clock,
  CheckCircle,
  ChevronDown,
  FileSpreadsheet,
  FileJson,
  Copy,
  Check,
} from 'lucide-react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useRecordsStore } from '@/stores/recordsStore';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/utils/helpers';
import {
  generateInspectionReport,
  downloadReport,
  generateHandoverRecord,
} from '@/utils/reportGenerator';
import type { Batch, AnalysisRun } from '@/types';

export const ExportPage: React.FC = () => {
  const { batches, analysisRuns, currentRun, loadBatches, loadAnalysisRuns, selectAnalysisRun } = useAnalysisStore();
  const { shiftRecords, loadShiftRecords } = useRecordsStore();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showBatchSelect, setShowBatchSelect] = useState(false);
  const [showRunSelect, setShowRunSelect] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadBatches();
    loadShiftRecords();
  }, []);

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches]);

  useEffect(() => {
    if (selectedBatchId) {
      loadAnalysisRuns(selectedBatchId);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (analysisRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(analysisRuns[0].id);
      selectAnalysisRun(analysisRuns[0]);
    }
  }, [analysisRuns]);

  useEffect(() => {
    if (selectedRunId && analysisRuns.length > 0) {
      const run = analysisRuns.find((r) => r.id === selectedRunId);
      if (run) {
        selectAnalysisRun(run);
      }
    }
  }, [selectedRunId, analysisRuns]);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const selectedRun = analysisRuns.find((r) => r.id === selectedRunId);

  const handleExportReport = (format: 'txt' | 'json') => {
    if (!selectedRun || !selectedBatch) return;

    const report = generateInspectionReport(
      selectedBatch,
      selectedRun,
      selectedRun.conclusions
    );

    if (format === 'json') {
      const jsonContent = JSON.stringify(
        {
          batch: selectedBatch,
          analysisRun: selectedRun,
          report: report,
        },
        null,
        2
      );
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-report-${selectedBatch.material?.batchNo}-v${selectedRun.version}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      downloadReport(report);
    }
  };

  const handleExportHandover = () => {
    if (!selectedRun || !selectedBatch) return;

    const recentShiftRecords = shiftRecords.slice(0, 5);
    const handover = generateHandoverRecord(
      selectedBatch,
      selectedRun,
      recentShiftRecords
    );
    downloadReport(handover);
  };

  const handleCopyReport = () => {
    if (!selectedRun || !selectedBatch) return;

    const report = generateInspectionReport(
      selectedBatch,
      selectedRun,
      selectedRun.conclusions
    );
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h1 className="text-2xl font-bold text-industrial-text">报告导出</h1>
          <p className="text-industrial-text-muted mt-1">
            生成巡检报告和交接班记录，便于下一班继续查询
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-industrial-text mb-4">选择数据</h3>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs text-industrial-text-muted mb-1">批次</label>
                <button
                  onClick={() => setShowBatchSelect(!showBatchSelect)}
                  className="w-full px-4 py-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-left text-industrial-text flex items-center justify-between"
                >
                  <span className="font-mono text-tech-blue">
                    {selectedBatch?.material?.batchNo || '请选择批次'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-industrial-text-dim transition-transform ${showBatchSelect ? 'rotate-180' : ''}`} />
                </button>

                {showBatchSelect && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-industrial-bg border border-industrial-border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {batches.map((batch) => (
                      <button
                        key={batch.id}
                        onClick={() => {
                          setSelectedBatchId(batch.id);
                          setSelectedRunId(null);
                          setShowBatchSelect(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-industrial-bg-lighter transition-colors"
                      >
                        <div className="font-mono text-tech-blue text-sm">
                          {batch.material?.batchNo}
                        </div>
                        <div className="text-xs text-industrial-text-muted">
                          {batch.material?.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs text-industrial-text-muted mb-1">分析版本</label>
                <button
                  onClick={() => setShowRunSelect(!showRunSelect)}
                  disabled={analysisRuns.length === 0}
                  className="w-full px-4 py-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-left text-industrial-text flex items-center justify-between disabled:opacity-50"
                >
                  {selectedRun ? (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-tech-blue">v{selectedRun.version}</span>
                      <StatusBadge type="analysis" status={selectedRun.status} />
                    </span>
                  ) : (
                    <span className="text-industrial-text-muted">请选择版本</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-industrial-text-dim transition-transform ${showRunSelect ? 'rotate-180' : ''}`} />
                </button>

                {showRunSelect && analysisRuns.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-industrial-bg border border-industrial-border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {analysisRuns.map((run) => {
                      const stats = getRunStats(run);
                      return (
                        <button
                          key={run.id}
                          onClick={() => {
                            setSelectedRunId(run.id);
                            setShowRunSelect(false);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-industrial-bg-lighter transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-tech-blue">v{run.version}</span>
                              <StatusBadge type="analysis" status={run.status} />
                            </div>
                            <span className="text-xs text-industrial-text-dim">
                              {formatDateTime(run.analysisTime)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-1">
                            {stats.dangerCount > 0 && (
                              <span className="text-danger-red">危险 {stats.dangerCount}</span>
                            )}
                            {stats.warningCount > 0 && (
                              <span className="text-alert-orange">警戒 {stats.warningCount}</span>
                            )}
                            {stats.dangerCount === 0 && stats.warningCount === 0 && (
                              <span className="text-signal-green">正常</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-industrial-text mb-4">导出选项</h3>

            <div className="space-y-3">
              <button
                onClick={() => handleExportReport('txt')}
                disabled={!selectedRun}
                className="w-full p-4 bg-industrial-bg border border-industrial-border rounded-lg hover:border-tech-blue/50 transition-colors text-left disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-tech-blue/20 rounded-lg">
                    <FileText className="w-5 h-5 text-tech-blue" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-industrial-text">巡检报告 (TXT)</p>
                    <p className="text-xs text-industrial-text-muted">
                      纯文本格式，便于快速查看和分享
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-industrial-text-dim group-hover:text-tech-blue transition-colors" />
                </div>
              </button>

              <button
                onClick={() => handleExportReport('json')}
                disabled={!selectedRun}
                className="w-full p-4 bg-industrial-bg border border-industrial-border rounded-lg hover:border-tech-blue/50 transition-colors text-left disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-data-purple/20 rounded-lg">
                    <FileJson className="w-5 h-5 text-data-purple" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-industrial-text">结构化数据 (JSON)</p>
                    <p className="text-xs text-industrial-text-muted">
                      包含完整分析数据，可用于二次分析
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-industrial-text-dim group-hover:text-data-purple transition-colors" />
                </div>
              </button>

              <button
                onClick={handleExportHandover}
                disabled={!selectedRun}
                className="w-full p-4 bg-industrial-bg border border-industrial-border rounded-lg hover:border-tech-blue/50 transition-colors text-left disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-signal-green/20 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-signal-green" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-industrial-text">交接班记录</p>
                    <p className="text-xs text-industrial-text-muted">
                      包含分析结论和近期班组记录，便于下一班接手
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-industrial-text-dim group-hover:text-signal-green transition-colors" />
                </div>
              </button>

              <button
                onClick={handleCopyReport}
                disabled={!selectedRun}
                className="w-full p-4 bg-industrial-bg border border-industrial-border rounded-lg hover:border-tech-blue/50 transition-colors text-left disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-alert-orange/20 rounded-lg">
                    {copied ? (
                      <Check className="w-5 h-5 text-signal-green" />
                    ) : (
                      <Copy className="w-5 h-5 text-alert-orange" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-industrial-text">
                      {copied ? '已复制到剪贴板' : '复制报告内容'}
                    </p>
                    <p className="text-xs text-industrial-text-muted">
                      快速复制到聊天工具中分享
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-industrial-text">报告预览</h3>
            {selectedRun && (
              <div className="flex items-center gap-2 text-xs text-industrial-text-muted">
                <Clock className="w-3 h-3" />
                {formatDateTime(selectedRun.analysisTime)}
              </div>
            )}
          </div>

          {!selectedRun || !selectedBatch ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <FileText className="w-12 h-12 text-industrial-text-dim mb-3" />
              <p className="text-industrial-text-muted mb-2">
                请先选择批次和分析版本
              </p>
              <p className="text-xs text-industrial-text-dim">
                选好后这里会显示报告预览
              </p>
            </div>
          ) : (
            <div className="bg-industrial-bg rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
              {generateInspectionReport(
                selectedBatch,
                selectedRun,
                selectedRun.conclusions
              )}
            </div>
          )}

          {selectedRun && (
            <div className="mt-4 pt-4 border-t border-industrial-border">
              <div className="flex items-center justify-between text-xs text-industrial-text-muted">
                <span>版本: v{selectedRun.version}</span>
                <span>
                  <CheckCircle className="w-3 h-3 inline mr-1 text-signal-green" />
                  可追溯
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
