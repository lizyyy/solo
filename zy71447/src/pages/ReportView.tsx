import { useCallback } from 'react';
import { Info, FileText, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { ReportExport } from '@/components/ReportExport';
import { RiskPanel } from '@/components/RiskPanel';
import { useInstrumentStore } from '@/store/useInstrumentStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useReportStore } from '@/store/useReportStore';
import { BusinessRules } from '@/utils/businessRules';
import { RISK_TYPE_LABELS } from '@/types';

export function ReportView() {
  const { instrumentData, sectionParams, currentBand } = useInstrumentStore();
  const {
    risks,
    autoDetect,
    showRawData,
    detectRisks,
    clearRisks,
    toggleAutoDetect,
    toggleShowRawData,
  } = useRiskStore();
  const {
    batches,
    selectedBatchIds,
    isGenerating,
    reviewer,
    createBatch,
    setReviewer,
    toggleBatchSelection,
    clearSelection,
    deleteBatch,
    exportBatch,
    exportSelectedBatches,
  } = useReportStore();

  const runDetection = useCallback(() => {
    if (instrumentData) {
      detectRisks(
        instrumentData.instrument,
        instrumentData.samples,
        instrumentData.hotspots,
        sectionParams,
        currentBand
      );
    }
  }, [instrumentData, sectionParams, currentBand, detectRisks]);

  const handleCreateBatch = useCallback(() => {
    if (instrumentData) {
      if (risks.length === 0) {
        runDetection();
      }
      const currentRisks = useRiskStore.getState().risks;
      createBatch(
        instrumentData.instrument,
        currentRisks,
        sectionParams,
        currentBand
      );
    }
  }, [instrumentData, risks, sectionParams, currentBand, createBatch, runDetection]);

  const handleExportBatch = useCallback(
    (batch: typeof batches[0]) => {
      exportBatch(batch, 'report-content');
    },
    [exportBatch]
  );

  const handleExportSelected = useCallback(() => {
    exportSelectedBatches('report-content');
  }, [exportSelectedBatches]);

  const handleReviewerChange = useCallback(
    (name: string) => {
      setReviewer(name);
    },
    [setReviewer]
  );

  if (!instrumentData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="loading-ring" />
      </div>
    );
  }

  const { instrument } = instrumentData;

  const riskTypeStats = {
    section_occlusion: risks.filter((r) => r.type === 'section_occlusion').length,
    band_mismatch: risks.filter((r) => r.type === 'band_mismatch').length,
    hotspot_missing: risks.filter((r) => r.type === 'hotspot_missing').length,
  };

  const riskSeverityStats = {
    high: risks.filter((r) => r.severity === 'high').length,
    medium: risks.filter((r) => r.severity === 'medium').length,
    low: risks.filter((r) => r.severity === 'low').length,
  };

  const overallStatus = risks.length === 0
    ? 'ready'
    : riskSeverityStats.high > 0
    ? 'critical'
    : riskSeverityStats.medium > 0
    ? 'warning'
    : 'minor';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl text-bronze-400">{instrument.name} · 报告导出</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            生成带批次标识的声学剖面检测报告，支持PDF导出。文件名格式：乐器声学剖面报告_批次{'{YYYYMMDD}'}_{'{批次号}'}_{'{乐器类型}'}.pdf
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <Info size={14} />
            <span>数据版本：v{instrument.dataVersion}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
          <div id="report-content" className="card-panel">
            <div className="text-center mb-6 pb-4 border-b border-charcoal-700">
              <h3 className="font-serif text-2xl text-bronze-400 mb-2">
                乐器声学剖面检测报告
              </h3>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500 font-mono">
                <span>乐器类型：{instrument.name}</span>
                <span>数据版本：v{instrument.dataVersion}</span>
                <span>检测日期：{new Date().toLocaleDateString('zh-CN')}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className={`p-3 rounded-lg text-center border ${
                overallStatus === 'ready' ? 'bg-acoustic-mid/10 border-acoustic-mid/30' :
                overallStatus === 'critical' ? 'bg-acoustic-high/10 border-acoustic-high/30' :
                overallStatus === 'warning' ? 'bg-bronze-900/20 border-bronze-700/30' :
                'bg-acoustic-low/10 border-acoustic-low/30'
              }`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  overallStatus === 'ready' ? 'bg-acoustic-mid/20' :
                  overallStatus === 'critical' ? 'bg-acoustic-high/20' :
                  overallStatus === 'warning' ? 'bg-bronze-900/30' :
                  'bg-acoustic-low/20'
                }`}>
                  {overallStatus === 'ready' ? (
                    <CheckCircle size={18} className="text-acoustic-mid" />
                  ) : (
                    <AlertTriangle size={18} className={
                      overallStatus === 'critical' ? 'text-acoustic-high' :
                      overallStatus === 'warning' ? 'text-bronze-500' :
                      'text-acoustic-low'
                    } />
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono">整体状态</p>
                <p className={`text-lg font-serif ${
                  overallStatus === 'ready' ? 'text-acoustic-mid' :
                  overallStatus === 'critical' ? 'text-acoustic-high' :
                  overallStatus === 'warning' ? 'text-bronze-500' :
                  'text-acoustic-low'
                }`}>
                  {overallStatus === 'ready' ? '正常' :
                   overallStatus === 'critical' ? '严重' :
                   overallStatus === 'warning' ? '警告' : '轻微'}
                </p>
              </div>
              <div className="p-3 rounded-lg text-center bg-charcoal-800/50 border border-charcoal-700">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center bg-charcoal-700">
                  <FileText size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 font-mono">风险总数</p>
                <p className="text-lg font-serif text-gray-300">{risks.length}</p>
              </div>
              <div className="p-3 rounded-lg text-center bg-charcoal-800/50 border border-charcoal-700">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center bg-charcoal-700">
                  <Download size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 font-mono">已生成批次</p>
                <p className="text-lg font-serif text-gray-300">{batches.length}</p>
              </div>
              <div className="p-3 rounded-lg text-center bg-charcoal-800/50 border border-charcoal-700">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center bg-charcoal-700">
                  <Info size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 font-mono">剖面轴</p>
                <p className="text-lg font-serif text-gray-300">{sectionParams.axis.toUpperCase()}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-serif text-lg text-bronze-400 mb-3">风险类型分布</h4>
              <div className="grid grid-cols-3 gap-3">
                {(['section_occlusion', 'band_mismatch', 'hotspot_missing'] as const).map((type) => (
                  <div
                    key={type}
                    className="p-3 rounded-lg bg-charcoal-800/50 border border-charcoal-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-gray-400">
                        {RISK_TYPE_LABELS[type]}
                      </span>
                      <span className={`text-lg font-serif ${
                        riskTypeStats[type] > 0 ? 'text-bronze-400' : 'text-gray-600'
                      }`}>
                        {riskTypeStats[type]}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-charcoal-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-bronze-600 to-bronze-400 transition-all duration-300"
                        style={{
                          width: risks.length > 0
                            ? `${(riskTypeStats[type] / risks.length) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-serif text-lg text-bronze-400 mb-3">检测参数</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-charcoal-800/50 border border-charcoal-700">
                  <p className="text-xs text-gray-500 font-mono mb-1">剖面位置</p>
                  <p className="text-sm text-gray-300 font-mono">
                    {sectionParams.axis.toUpperCase()} = {sectionParams.position.toFixed(3)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-charcoal-800/50 border border-charcoal-700">
                  <p className="text-xs text-gray-500 font-mono mb-1">当前频段</p>
                  <p className="text-sm text-gray-300 font-mono">
                    {currentBand === 'low' ? '低频 (80-250Hz)' :
                     currentBand === 'mid' ? '中频 (250-2000Hz)' :
                     '高频 (2000-8000Hz)'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-charcoal-800/50 border border-charcoal-700">
                  <p className="text-xs text-gray-500 font-mono mb-1">显示切面</p>
                  <p className="text-sm text-gray-300 font-mono">
                    {sectionParams.showCutSurface ? '开启' : '关闭'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-charcoal-800/50 border border-charcoal-700">
                  <p className="text-xs text-gray-500 font-mono mb-1">显示内部</p>
                  <p className="text-sm text-gray-300 font-mono">
                    {sectionParams.showInternal ? '开启' : '关闭'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-serif text-lg text-bronze-400 mb-3">业务规则摘要</h4>
              <div className="space-y-2">
                {BusinessRules.getRuleSummary().map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-charcoal-800/50 rounded-lg border border-charcoal-700/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-mono text-bronze-400">{rule.category}</span>
                      {rule.threshold && (
                        <span className="text-xs text-gray-500 font-mono">
                          阈值：{rule.threshold}{rule.thresholdUnit}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono leading-relaxed">
                      {rule.rule}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card-panel">
            <h3 className="font-serif text-lg text-bronze-400 mb-3">报告命名规则说明</h3>
            <div className="p-3 bg-walnut-900/20 rounded-lg border border-bronze-700/30">
              <p className="text-xs text-bronze-300 font-mono mb-2">
                文件名格式：<code className="text-bronze-400">乐器声学剖面报告_批次{'{YYYYMMDD}'}_{'{批次号}'}_{'{乐器类型}'}.pdf</code>
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• <span className="text-gray-500 font-mono">YYYYMMDD</span>：生成日期，便于按时间排序</li>
                <li>• <span className="text-gray-500 font-mono">批次号</span>：三位递增序号，同日多批次可区分</li>
                <li>• <span className="text-gray-500 font-mono">乐器类型</span>：古琴/琵琶/提琴，便于分类归档</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                报告内容包含：批次信息、风险分类明细、原始数据快照、检测参数、业务规则说明
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
          <ReportExport
            batches={batches}
            selectedBatchIds={selectedBatchIds}
            onToggleSelection={toggleBatchSelection}
            onClearSelection={clearSelection}
            onDelete={deleteBatch}
            onExport={handleExportBatch}
            onExportSelected={handleExportSelected}
            isGenerating={isGenerating}
            onCreateBatch={handleCreateBatch}
            reviewer={reviewer}
            onReviewerChange={handleReviewerChange}
          />

          <RiskPanel
            risks={risks}
            autoDetect={autoDetect}
            showRawData={showRawData}
            onDetect={runDetection}
            onToggleAutoDetect={toggleAutoDetect}
            onToggleShowRawData={toggleShowRawData}
            onClear={clearRisks}
          />
        </div>
      </div>
    </div>
  );
}
