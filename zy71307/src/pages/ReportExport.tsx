import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download, FileSpreadsheet, FileImage, Check, Eye, Settings, Copy, CheckCheck } from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { exportToCSV, exportToPDF, generateReportMarkdown } from '@/utils/export';
import Empty from '@/components/Empty';
import type { ReportConfig } from '@/types';

export const ReportExport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    includeCalculationSteps: true,
    includeAnomalyDetails: true,
    includeRawData: true,
    format: 'csv',
  });

  const {
    experiments,
    loadExperiment,
    getCurrentExperiment,
    filterConditions,
  } = useExperimentStore();

  useEffect(() => {
    if (id && !experiments.some(e => e.id === id)) {
      loadExperiment(id);
    }
  }, [id, experiments, loadExperiment]);

  const exp = getCurrentExperiment();

  const reportMarkdown = useMemo(() => {
    if (!exp) return '';
    return generateReportMarkdown(exp, reportConfig);
  }, [exp, reportConfig]);

  const handleCopyMarkdown = async () => {
    if (!reportMarkdown) return;
    await navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (!exp) return;
    exportToCSV(exp, reportConfig);
  };

  const handleExportPDF = async () => {
    if (!exp) return;
    await exportToPDF('report-preview', exp);
  };

  const handleExportMarkdown = () => {
    if (!reportMarkdown || !exp) return;
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exp.name}_实验报告_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
  };

  if (!exp) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  const includedAnomalies = exp.anomalies.filter(a => a.isIncludedInReport).length;

  return (
    <div className="h-full overflow-hidden flex">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-100 flex items-center gap-3">
              <FileText className="text-tech-400" size={28} />
              报告导出
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              生成包含拟合结果、效率分析、异常检测的完整实验报告
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showPreview
                  ? 'bg-tech-500/10 border-tech-500/30 text-tech-400'
                  : 'border-industrial-600 text-gray-300 hover:bg-industrial-800'
              }`}
            >
              <Eye size={16} />
              <span className="text-sm font-medium">预览</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-6">
            <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-5">
              <h3 className="font-display text-sm font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Settings size={16} className="text-gray-400" />
                导出配置
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeRawData}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeRawData: e.target.checked })}
                    className="w-4 h-4 rounded border-industrial-600 bg-industrial-900 text-tech-500 focus:ring-tech-500 focus:ring-offset-0"
                  />
                  <div>
                    <p className="text-sm text-gray-200 group-hover:text-gray-100">包含原始数据</p>
                    <p className="text-xs text-gray-500">导出所有数据点的详细记录</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCalculationSteps}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeCalculationSteps: e.target.checked })}
                    className="w-4 h-4 rounded border-industrial-600 bg-industrial-900 text-tech-500 focus:ring-tech-500 focus:ring-offset-0"
                  />
                  <div>
                    <p className="text-sm text-gray-200 group-hover:text-gray-100">包含计算过程</p>
                    <p className="text-xs text-gray-500">保留拟合和效率计算的中间步骤</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeAnomalyDetails}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeAnomalyDetails: e.target.checked })}
                    className="w-4 h-4 rounded border-industrial-600 bg-industrial-900 text-tech-500 focus:ring-tech-500 focus:ring-offset-0"
                  />
                  <div>
                    <p className="text-sm text-gray-200 group-hover:text-gray-100">包含异常详情</p>
                    <p className="text-xs text-gray-500">包含 {includedAnomalies}/{exp.anomalies.length} 个标记的异常点</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-5">
              <h3 className="font-display text-sm font-semibold text-gray-100 mb-4">当前筛选条件</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">排除异常点</span>
                  <span className={`font-mono ${filterConditions.excludeAnomalies ? 'text-alert-orange' : 'text-gray-300'}`}>
                    {filterConditions.excludeAnomalies ? '已启用' : '未启用'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">转速范围</span>
                  <span className="font-mono text-gray-300">
                    {filterConditions.rpmRange ? `${filterConditions.rpmRange[0]} - ${filterConditions.rpmRange[1]} RPM` : '全部'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">电压范围</span>
                  <span className="font-mono text-gray-300">
                    {filterConditions.voltageRange ? `${filterConditions.voltageRange[0]} - ${filterConditions.voltageRange[1]} V` : '全部'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">桨径</span>
                  <span className="font-mono text-gray-300">
                    {filterConditions.propellerDiameter ? `${filterConditions.propellerDiameter} inch` : '全部'}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-industrial-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">有效数据点</span>
                  <span className="font-mono text-alert-green">
                    {exp.dataPoints.filter(p => !p.isExcluded).length} / {exp.dataPoints.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-5">
              <h3 className="font-display text-sm font-semibold text-gray-100 mb-4">导出格式</h3>
              <div className="space-y-3">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-industrial-700/50 hover:bg-industrial-700 border border-industrial-600 rounded-lg transition-colors group"
                >
                  <div className="p-2 bg-alert-green/20 rounded">
                    <FileSpreadsheet className="text-alert-green" size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-100 group-hover:text-white">CSV 表格</p>
                    <p className="text-xs text-gray-500">适合数据处理和进一步分析</p>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-gray-200" />
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-industrial-700/50 hover:bg-industrial-700 border border-industrial-600 rounded-lg transition-colors group"
                >
                  <div className="p-2 bg-alert-red/20 rounded">
                    <FileImage className="text-alert-red" size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-100 group-hover:text-white">PDF 文档</p>
                    <p className="text-xs text-gray-500">适合打印和正式存档</p>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-gray-200" />
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-industrial-700/50 hover:bg-industrial-700 border border-industrial-600 rounded-lg transition-colors group"
                >
                  <div className="p-2 bg-tech-500/20 rounded">
                    <FileText className="text-tech-400" size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-100 group-hover:text-white">Markdown</p>
                    <p className="text-xs text-gray-500">适合文档系统和版本控制</p>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-gray-200" />
                </button>
                <button
                  onClick={handleCopyMarkdown}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-tech-500/10 hover:bg-tech-500/20 border border-tech-500/30 rounded-lg transition-colors group"
                >
                  <div className="p-2 bg-tech-500/20 rounded">
                    {copied ? <CheckCheck className="text-alert-green" size={20} /> : <Copy className="text-tech-400" size={20} />}
                  </div>
                  <div className="text-left flex-1">
                    <p className={`text-sm font-medium ${copied ? 'text-alert-green' : 'text-tech-400 group-hover:text-tech-300'}`}>
                      {copied ? '已复制' : '复制 Markdown'}
                    </p>
                    <p className="text-xs text-gray-500">复制到剪贴板</p>
                  </div>
                  {copied && <Check size={18} className="text-alert-green" />}
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-tech-500/10 to-alert-green/10 border border-tech-500/30 rounded-lg p-5">
              <h3 className="font-display text-sm font-semibold text-gray-100 mb-3">报告摘要</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">实验名称</span>
                  <span className="text-gray-100 font-medium truncate ml-4 max-w-[150px]" title={exp.name}>{exp.name}</span>
                </div>
                {exp.fittingResult && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">拟合优度 R²</span>
                      <span className="font-mono text-tech-400">{exp.fittingResult.rSquared.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">拟合公式</span>
                      <span className="font-mono text-gray-100 truncate ml-4 max-w-[150px]" title={exp.fittingResult.formula}>
                        {exp.fittingResult.formula}
                      </span>
                    </div>
                  </>
                )}
                {exp.efficiencyResult && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">最高效率</span>
                      <span className="font-mono text-alert-green">{exp.efficiencyResult.optimalOperatingPoint.efficiency.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">最佳转速</span>
                      <span className="font-mono text-gray-100">{exp.efficiencyResult.optimalOperatingPoint.rpm} RPM</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">异常点</span>
                  <span className={`font-mono ${exp.anomalies.length > 0 ? 'text-alert-orange' : 'text-alert-green'}`}>
                    {exp.anomalies.length} 个
                  </span>
                </div>
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="col-span-2">
              <div className="bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-700">
                  <h3 className="font-display text-sm font-semibold text-gray-100">报告预览 (Markdown)</h3>
                  <span className="text-xs text-gray-500 font-mono">
                    {reportMarkdown.length} 字符
                  </span>
                </div>
                <div id="report-preview" className="flex-1 overflow-auto p-6 bg-industrial-900">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="bg-transparent p-0 text-xs text-gray-300 font-mono whitespace-pre-wrap">
                      {reportMarkdown}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
