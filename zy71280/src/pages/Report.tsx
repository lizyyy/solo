import React, { useState, useEffect } from 'react';
import { FileText, Download, FileSpreadsheet, FileCode, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useAuctionStore } from '../store/useAuctionStore';
import { MetricCard } from '../components/MetricCard';
import { formatCurrency, formatPercent, formatDate, formatScenario, formatSeverity } from '../utils/formatters';
import { exportToPDF, exportToExcel } from '../utils/reportGenerator';
import { cn } from '@/lib/utils';

const Report: React.FC = () => {
  const {
    items,
    selectedItemId,
    calculationResults,
    optimalPoints,
    anomalies,
    report,
    generateReport,
  } = useAuctionStore();

  const [includeModules, setIncludeModules] = useState({
    summary: true,
    scenarios: true,
    anomalies: true,
    parameters: true,
    rules: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedItem = items.find(i => i.id === selectedItemId);

  useEffect(() => {
    if (selectedItemId && calculationResults && !report) {
      handleGenerateReport();
    }
  }, [selectedItemId, calculationResults]);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      generateReport();
      setIsGenerating(false);
    }, 500);
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (!report) return;
    if (format === 'pdf') {
      exportToPDF(report);
    } else {
      exportToExcel(report);
    }
  };

  if (!selectedItem || !calculationResults) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">请先完成计算分析</h2>
          <p className="mt-2 text-sm text-slate-500">在「计算分析」页面完成计算后，可生成优化报告</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            报告导出
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            生成完整的保留价优化报告，支持PDF和Excel格式下载
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            {isGenerating ? '生成中...' : '刷新报告'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!report}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-amber-400 rounded-md hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={!report}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {report && (
            <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white p-6">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span className="text-xs uppercase tracking-wider text-slate-400">拍卖保留价优化报告</span>
                </div>
                <h2 className="text-2xl font-bold text-amber-400" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {report.itemSummary.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  生成时间：{formatDate(report.generatedAt)}
                </p>
              </div>

              {includeModules.summary && (
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    拍品概述与最优保留价建议
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500">拍品类目</p>
                      <p className="text-sm font-medium text-slate-700">{report.itemSummary.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">估值金额</p>
                      <p className="text-sm font-medium text-slate-900 font-mono">{formatCurrency(report.itemSummary.appraisedValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">品相状态</p>
                      <p className="text-sm font-medium text-slate-700">{report.itemSummary.condition}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">估值机构</p>
                      <p className="text-sm font-medium text-slate-700 truncate">{report.itemSummary.appraiser || '-'}</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-md p-5 text-center">
                    <p className="text-sm text-slate-400 mb-1">建议保留价</p>
                    <p className="text-4xl font-bold text-amber-400" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      {formatCurrency(report.optimalReservePrice)}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                      建议区间：{formatCurrency(report.reservePriceRange[0])} - {formatCurrency(report.reservePriceRange[1])}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      占估值比例：{formatPercent(report.optimalReservePrice / report.itemSummary.appraisedValue)}
                    </p>
                  </div>
                </div>
              )}

              {includeModules.scenarios && (
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    情景对比分析
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['conservative', 'neutral', 'optimistic'] as const).map((scenario) => {
                      const point = report.scenarios[scenario];
                      return (
                        <div
                          key={scenario}
                          className={cn(
                            'rounded-md border p-4',
                            scenario === 'neutral'
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-200 bg-white'
                          )}
                        >
                          <h4 className={cn(
                            'font-semibold mb-3',
                            scenario === 'neutral' ? 'text-amber-700' : 'text-slate-700'
                          )}>
                            {formatScenario(scenario)}情景
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">保留价</span>
                              <span className="font-mono font-medium text-slate-900">{formatCurrency(point.reservePrice)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">期望收益</span>
                              <span className="font-mono text-slate-700">{formatCurrency(point.expectedRevenue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">期望佣金</span>
                              <span className="font-mono text-amber-600">{formatCurrency(point.expectedCommission)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">流拍概率</span>
                              <span className={cn(
                                'font-medium',
                                point.unsoldProbability > 0.4 ? 'text-red-600' : 'text-emerald-600'
                              )}>{formatPercent(point.unsoldProbability)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">置信度</span>
                              <span className={cn(
                                'font-medium',
                                point.confidence < 0.7 ? 'text-amber-600' : 'text-emerald-600'
                              )}>{formatPercent(point.confidence)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {includeModules.anomalies && report.anomalies.length > 0 && (
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    异常检测结果
                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                      {report.anomalies.length}项异常
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {report.anomalies.slice(0, 5).map((anomaly, index) => (
                      <div key={anomaly.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-md">
                        <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded',
                              anomaly.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              anomaly.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                              anomaly.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            )}>
                              {formatSeverity(anomaly.severity)}
                            </span>
                            <h4 className="text-sm font-medium text-slate-900">{anomaly.title}</h4>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{anomaly.description}</p>
                        </div>
                      </div>
                    ))}
                    {report.anomalies.length > 5 && (
                      <p className="text-xs text-slate-500 text-center py-2">
                        ... 另有 {report.anomalies.length - 5} 项异常，请查看完整报告
                      </p>
                    )}
                  </div>
                </div>
              )}

              {includeModules.parameters && (
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                    参数配置快照
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-500">风险容忍度</p>
                      <p className="text-sm font-medium text-slate-700">{report.parameterSnapshot.riskTolerance}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-500">保留价区间</p>
                      <p className="text-sm font-medium text-slate-700">{formatPercent(report.parameterSnapshot.minReserveRatio)}-{formatPercent(report.parameterSnapshot.maxReserveRatio)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-500">最大流拍概率</p>
                      <p className="text-sm font-medium text-slate-700">{formatPercent(report.parameterSnapshot.maxUnsoldProbability)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-500">最低佣金保障</p>
                      <p className="text-sm font-medium text-slate-700">{formatCurrency(report.parameterSnapshot.minCommissionGuarantee)}</p>
                    </div>
                  </div>
                </div>
              )}

              {includeModules.rules && (
                <div className="p-6 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                    规则说明附录
                  </h3>
                  <div className="text-xs text-slate-600 space-y-3 font-mono bg-white p-4 rounded border border-slate-200 max-h-60 overflow-y-auto">
                    {report.ruleNotes.split('\n').filter(l => l.trim()).map((line, i) => (
                      <p key={i} className={line.startsWith('##') ? 'font-semibold text-slate-800 pt-2' : line.startsWith('###') ? 'font-medium text-slate-700 pt-1' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">导出配置</h3>
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-2">选择包含模块：</p>
              {Object.entries({
                summary: '拍品概述与最优建议',
                scenarios: '情景对比分析',
                anomalies: '异常检测结果',
                parameters: '参数配置快照',
                rules: '规则说明附录',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeModules[key as keyof typeof includeModules]}
                    onChange={(e) => setIncludeModules(prev => ({
                      ...prev,
                      [key]: e.target.checked
                    }))}
                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">导出格式</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('pdf')}
                disabled={!report}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-md hover:border-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                  <FileCode className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-slate-900">PDF格式</p>
                  <p className="text-xs text-slate-500">适合打印和存档，排版美观</p>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={!report}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-md hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-emerald-100 rounded flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-slate-900">Excel格式</p>
                  <p className="text-xs text-slate-500">适合数据分析，多Sheet结构</p>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {anomalies.length > 0 && (
            <div className={cn(
              'rounded-md border p-5',
              anomalies.some(a => a.severity === 'critical')
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            )}>
              <div className="flex items-start gap-3">
                {anomalies.some(a => a.severity === 'critical') ? (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className={cn(
                    'text-sm font-semibold',
                    anomalies.some(a => a.severity === 'critical') ? 'text-red-800' : 'text-amber-800'
                  )}>
                    报告包含 {anomalies.length} 项异常提示
                  </h4>
                  <p className={cn(
                    'mt-1 text-xs',
                    anomalies.some(a => a.severity === 'critical') ? 'text-red-600' : 'text-amber-600'
                  )}>
                    请在做最终决策前，仔细阅读异常检测章节的判断依据和修正建议。
                  </p>
                </div>
              </div>
            </div>
          )}

          {report && anomalies.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-800">数据质量良好</h4>
                  <p className="mt-1 text-xs text-emerald-600">
                    未检测到异常项，计算结果置信度较高。
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              title="最优保留价"
              value={report ? formatCurrency(report.optimalReservePrice) : '-'}
              className="ring-2 ring-amber-400"
            />
            <MetricCard
              title="建议区间"
              value={report ? `${formatCurrency(report.reservePriceRange[0])}-${formatCurrency(report.reservePriceRange[1])}` : '-'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
