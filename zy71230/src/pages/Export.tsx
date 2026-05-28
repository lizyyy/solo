import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Globe,
  Check,
  Eye,
  Settings,
} from 'lucide-react';
import { useReviewAnalysis } from '../hooks/useReviewAnalysis';
import { useGameEngine } from '../hooks/useGameEngine';
import { exportToPDF, exportToExcel } from '../utils/exporters/reportExporter';
import NeonButton from '../components/ui/NeonButton';
import NeonCard from '../components/ui/NeonCard';
import type { ReviewReport, ExportOptions } from '../types';

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function Export() {
  const navigate = useNavigate();
  const [exportFormat, setExportFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    includeRawData: false,
    includeCharts: true,
    includeAlternativePaths: true,
    language: 'zh',
  });

  const {
    currentTour,
    stops,
    merchItems,
    decisions,
    riskEvents,
    stopResults,
    cashFlow,
    riskIndex,
  } = useGameEngine();

  const { generateReviewReport } = useReviewAnalysis();

  const gameState = useMemo(() => ({
    currentTour,
    stops,
    merchItems,
    currentStopIndex: stops.findIndex(s => s.status === 'current'),
    gamePhase: 'review' as const,
    cashFlow,
    totalRevenue: stopResults.reduce((sum, r) => sum + r.totalRevenue, 0),
    totalExpense: stopResults.reduce((sum, r) => sum + r.totalExpense, 0),
    riskIndex,
    decisions,
    riskEvents,
    stopResults,
    isPaused: false,
    isGameOver: true,
    dailySalesRate: {},
  }), [currentTour, stops, merchItems, cashFlow, riskIndex, decisions, riskEvents, stopResults]);

  const report: ReviewReport | null = useMemo(() => {
    if (!currentTour) return null;
    try {
      return generateReviewReport(
        gameState,
        currentTour,
        stops,
        merchItems,
        decisions,
        riskEvents,
        stopResults
      );
    } catch (error) {
      console.error('Failed to generate review report:', error);
      return null;
    }
  }, [gameState, currentTour, stops, merchItems, decisions, riskEvents, stopResults, generateReviewReport]);

  const handleExport = async () => {
    if (!report) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);
    setExportComplete(false);

    const exportOptions = { ...options, format: exportFormat };

    try {
      for (let i = 0; i <= 90; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setExportProgress(i);
      }

      if (exportFormat === 'pdf') {
        await exportToPDF(report, exportOptions);
      } else {
        await exportToExcel(report, exportOptions);
      }

      setExportProgress(100);
      setExportComplete(true);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : '导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOptionChange = (key: keyof ExportOptions, value: boolean | string) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-rock-dark flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-warning-orange mx-auto mb-4" />
          <p className="text-gray-400 text-lg">暂无可导出的报告数据</p>
          <NeonButton className="mt-6" onClick={() => navigate('/review')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回复盘页
          </NeonButton>
        </div>
      </div>
    );
  }

  const { executionSummary, financialOverview, stopAnalysis, riskAnalysis, decisionAnalysis, recommendations } = report;

  return (
    <div className="min-h-screen bg-rock-dark p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <NeonButton variant="secondary" size="sm" onClick={() => navigate('/review')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回
          </NeonButton>
          <h1 className="font-rock text-3xl uppercase tracking-wider text-neon-pink">
            导出报告
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <NeonCard borderColor="neon-cyan" title={<div className="flex items-center gap-2"><Eye className="w-5 h-5" />报告预览</div>}>
              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                <div className="p-4 bg-rock-light/10 rounded-sm">
                  <h4 className="font-rock text-neon-pink uppercase text-sm mb-3">执行摘要</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">巡演名称：</span>
                      <span className="text-white">{executionSummary.tourName}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">结果：</span>
                      <span className={executionSummary.isSuccess ? 'text-success-green' : 'text-danger-red'}>
                        {executionSummary.isSuccess ? '成功' : '失败'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">最终现金流：</span>
                      <span className="text-neon-cyan">{formatCurrency(executionSummary.finalCashFlow)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">净利润：</span>
                      <span className={executionSummary.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}>
                        {formatCurrency(executionSummary.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-rock-light/10 rounded-sm">
                  <h4 className="font-rock text-neon-cyan uppercase text-sm mb-3">财务总览</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-400">总收入：</span>
                      <span className="text-success-green">{formatCurrency(financialOverview.totalRevenue)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">总支出：</span>
                      <span className="text-danger-red">{formatCurrency(financialOverview.totalExpense)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">利润率：</span>
                      <span className={financialOverview.profitMargin >= 0 ? 'text-success-green' : 'text-danger-red'}>
                        {formatPercentage(financialOverview.profitMargin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">站点数：</span>
                      <span className="text-white">{stopAnalysis.length}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    包含 {financialOverview.revenueBreakdown.length} 项收入分类，
                    {financialOverview.expenseBreakdown.length} 项支出分类
                  </div>
                </div>

                <div className="p-4 bg-rock-light/10 rounded-sm">
                  <h4 className="font-rock text-neon-purple uppercase text-sm mb-3">风险分析</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">风险总数：</span>
                      <span className="text-warning-orange">{riskAnalysis.totalRisks}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">高风险事件：</span>
                      <span className="text-danger-red">{riskAnalysis.highRiskEvents.length}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-rock-light/10 rounded-sm">
                  <h4 className="font-rock text-warning-orange uppercase text-sm mb-3">决策分析</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">决策总数：</span>
                      <span className="text-neon-cyan">{decisionAnalysis.totalDecisions}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">平均影响：</span>
                      <span className={decisionAnalysis.averageImpact >= 0 ? 'text-success-green' : 'text-danger-red'}>
                        {formatCurrency(decisionAnalysis.averageImpact)}
                      </span>
                    </div>
                  </div>
                </div>

                {recommendations.length > 0 && (
                  <div className="p-4 bg-rock-light/10 rounded-sm">
                    <h4 className="font-rock text-success-green uppercase text-sm mb-3">改进建议</h4>
                    <div className="text-sm">
                      <span className="text-gray-400">建议数量：</span>
                      <span className="text-white">{recommendations.length}</span>
                      <div className="mt-2 space-y-1">
                        {recommendations.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="text-xs text-gray-400 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              rec.priority === 'high' ? 'bg-danger-red' :
                              rec.priority === 'medium' ? 'bg-warning-orange' : 'bg-neon-cyan'
                            }`} />
                            {rec.title}
                          </div>
                        ))}
                        {recommendations.length > 3 && (
                          <div className="text-xs text-gray-500">
                            还有 {recommendations.length - 3} 条建议...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center pt-4 border-t border-rock-light/30">
                  报告生成时间：{new Date(report.generatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            </NeonCard>
          </div>

          <div className="space-y-6">
            <NeonCard borderColor="neon-pink" title={<div className="flex items-center gap-2"><Settings className="w-5 h-5" />导出格式</div>}>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`p-4 border-2 rounded-sm transition-all duration-300 ${
                    exportFormat === 'pdf'
                      ? 'border-neon-pink bg-neon-pink/10'
                      : 'border-rock-light/30 hover:border-neon-pink/50'
                  }`}
                >
                  <FileText className={`w-8 h-8 mx-auto mb-2 ${exportFormat === 'pdf' ? 'text-neon-pink' : 'text-gray-400'}`} />
                  <p className={`font-rock uppercase text-sm ${exportFormat === 'pdf' ? 'text-neon-pink' : 'text-gray-400'}`}>
                    PDF
                  </p>
                  <p className="text-xs text-gray-500 mt-1">适合打印和分享</p>
                </button>

                <button
                  onClick={() => setExportFormat('xlsx')}
                  className={`p-4 border-2 rounded-sm transition-all duration-300 ${
                    exportFormat === 'xlsx'
                      ? 'border-neon-green bg-success-green/10'
                      : 'border-rock-light/30 hover:border-success-green/50'
                  }`}
                >
                  <FileSpreadsheet className={`w-8 h-8 mx-auto mb-2 ${exportFormat === 'xlsx' ? 'text-success-green' : 'text-gray-400'}`} />
                  <p className={`font-rock uppercase text-sm ${exportFormat === 'xlsx' ? 'text-success-green' : 'text-gray-400'}`}>
                    Excel
                  </p>
                  <p className="text-xs text-gray-500 mt-1">适合数据分析</p>
                </button>
              </div>
            </NeonCard>

            <NeonCard borderColor="neon-purple" title="导出选项">
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center transition-all ${
                      options.includeRawData ? 'bg-neon-purple border-neon-purple' : 'border-rock-light/50 group-hover:border-neon-purple/50'
                    }`}>
                      {options.includeRawData && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-gray-300 text-sm">包含原始数据</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.includeRawData}
                    onChange={(e) => handleOptionChange('includeRawData', e.target.checked)}
                    className="sr-only"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center transition-all ${
                      options.includeCharts ? 'bg-neon-purple border-neon-purple' : 'border-rock-light/50 group-hover:border-neon-purple/50'
                    }`}>
                      {options.includeCharts && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-gray-300 text-sm">包含图表</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.includeCharts}
                    onChange={(e) => handleOptionChange('includeCharts', e.target.checked)}
                    className="sr-only"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center transition-all ${
                      options.includeAlternativePaths ? 'bg-neon-purple border-neon-purple' : 'border-rock-light/50 group-hover:border-neon-purple/50'
                    }`}>
                      {options.includeAlternativePaths && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-gray-300 text-sm">包含替代路径分析</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.includeAlternativePaths}
                    onChange={(e) => handleOptionChange('includeAlternativePaths', e.target.checked)}
                    className="sr-only"
                  />
                </label>
              </div>
            </NeonCard>

            <NeonCard borderColor="neon-cyan" title={<div className="flex items-center gap-2"><Globe className="w-5 h-5" />语言选择</div>}>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleOptionChange('language', 'zh')}
                  className={`p-3 border-2 rounded-sm transition-all duration-300 ${
                    options.language === 'zh'
                      ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                      : 'border-rock-light/30 text-gray-400 hover:border-neon-cyan/50'
                  }`}
                >
                  <span className="font-rock uppercase text-sm">中文</span>
                </button>
                <button
                  onClick={() => handleOptionChange('language', 'en')}
                  className={`p-3 border-2 rounded-sm transition-all duration-300 ${
                    options.language === 'en'
                      ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                      : 'border-rock-light/30 text-gray-400 hover:border-neon-cyan/50'
                  }`}
                >
                  <span className="font-rock uppercase text-sm">English</span>
                </button>
              </div>
            </NeonCard>

            {exportError && (
              <NeonCard borderColor="danger-red">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-danger-red flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-danger-red font-rock text-sm">导出失败</p>
                    <p className="text-gray-400 text-sm mt-1">{exportError}</p>
                  </div>
                </div>
              </NeonCard>
            )}

            {exportComplete && !exportError && (
              <NeonCard borderColor="success-green">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-success-green" />
                  <div>
                    <p className="text-success-green font-rock">下载完成！</p>
                    <p className="text-gray-400 text-sm">报告已保存到您的下载文件夹</p>
                  </div>
                </div>
              </NeonCard>
            )}

            <div className="space-y-4">
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">正在导出...</span>
                    <span className="text-neon-pink font-rock">{exportProgress}%</span>
                  </div>
                  <div className="h-2 bg-rock-light/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neon-pink to-neon-purple transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <NeonButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleExport}
                disabled={isExporting}
                loading={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    导出 {exportFormat.toUpperCase()}
                  </>
                )}
              </NeonButton>

              {exportComplete && (
                <NeonButton
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setExportComplete(false);
                    setExportProgress(0);
                  }}
                >
                  再次导出
                </NeonButton>
              )}
            </div>

            <div className="p-4 bg-rock-light/5 rounded-sm border border-rock-light/20">
              <p className="text-xs text-gray-500">
                <span className="text-neon-pink font-rock">提示：</span>
                {exportFormat === 'pdf'
                  ? 'PDF 格式适合打印和分享，包含完整的报告排版。'
                  : 'Excel 格式适合进一步数据分析，包含所有原始数据表。'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
