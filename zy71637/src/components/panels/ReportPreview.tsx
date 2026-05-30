import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  FileJson,
  FileSpreadsheet,
  FileImage,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Hash,
  BarChart3,
  Sparkles,
  Eye,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useUIStore } from '../../store/useUIStore';
import {
  generateReportSummary,
  downloadHTMLReport,
  downloadPDFReport,
  downloadJSONData,
  ReportConfig,
} from '../../engine/reportGenerator';
import { formatDate, formatDateTime, formatDuration } from '../../utils/formatters';

export const ReportPreview: React.FC = () => {
  const { processedSnapshots, anomalies, cubes } = useDataStore();
  const { annotations } = useAnnotationStore();
  const { setToast } = useUIStore();

  const [config, setConfig] = useState<ReportConfig>({
    title: `期货盘口复盘报告_${formatDate(Date.now())}`,
    author: '量化分析师',
    includeRawData: false,
    includeCharts: true,
    includeAnnotations: true,
    includeAnomalies: true,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewHTML, setPreviewHTML] = useState<string>('');

  const summary = useMemo(() => {
    return generateReportSummary(processedSnapshots, anomalies, annotations);
  }, [processedSnapshots, anomalies, annotations]);

  useEffect(() => {
    if (processedSnapshots.length > 0) {
      const previewData = {
        snapshots: processedSnapshots.slice(0, 10),
        anomalies: anomalies.slice(0, 5),
        annotations: annotations.slice(0, 3),
        config,
        generatedAt: Date.now(),
      };
      // 只生成简单的预览HTML
      const summaryHTML = `
        <div style="font-family: system-ui; padding: 16px; color: #e2e8f0;">
          <h3 style="margin: 0 0 12px 0; color: #f1f5f9;">报告预览</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: #1e293b; padding: 8px; border-radius: 6px;">
              <div style="color: #94a3b8;">快照数</div>
              <div style="font-size: 16px; font-weight: 600;">${summary.totalSnapshots}</div>
            </div>
            <div style="background: #1e293b; padding: 8px; border-radius: 6px;">
              <div style="color: #94a3b8;">异常数</div>
              <div style="font-size: 16px; font-weight: 600; color: ${summary.totalAnomalies > 0 ? '#f87171' : '#34d399'};">${summary.totalAnomalies}</div>
            </div>
            <div style="background: #1e293b; padding: 8px; border-radius: 6px;">
              <div style="color: #94a3b8;">时间跨度</div>
              <div style="font-size: 16px; font-weight: 600;">${formatDuration(summary.timeSpan)}</div>
            </div>
            <div style="background: #1e293b; padding: 8px; border-radius: 6px;">
              <div style="color: #94a3b8;">质量评分</div>
              <div style="font-size: 16px; font-weight: 600; color: ${summary.dataQualityScore >= 80 ? '#34d399' : summary.dataQualityScore >= 60 ? '#fbbf24' : '#f87171'};">${summary.dataQualityScore.toFixed(0)}</div>
            </div>
          </div>
        </div>
      `;
      setPreviewHTML(summaryHTML);
    }
  }, [processedSnapshots, anomalies, annotations, summary]);

  const handleExport = async (type: 'html' | 'pdf' | 'json') => {
    setIsGenerating(true);

    try {
      const reportData = {
        snapshots: processedSnapshots,
        anomalies,
        annotations,
        config,
        generatedAt: Date.now(),
      };

      await new Promise((resolve) => setTimeout(resolve, 500));

      switch (type) {
        case 'html':
          downloadHTMLReport(reportData);
          setToast('HTML报告已下载', 'success');
          break;
        case 'pdf':
          await downloadPDFReport(reportData);
          setToast('PDF报告已下载', 'success');
          break;
        case 'json':
          downloadJSONData(processedSnapshots, anomalies, annotations);
          setToast('JSON数据已下载', 'success');
          break;
      }
    } catch (error) {
      console.error('导出失败:', error);
      setToast('导出失败，请重试', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  if (processedSnapshots.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
          <FileText className="text-slate-600" size={28} />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">暂无数据</h3>
        <p className="text-sm text-slate-500">
          请先导入或生成盘口数据后再创建报告
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <motion.div
        className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Sparkles className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">复盘报告</h3>
            <p className="text-sm text-slate-400">一键生成完整分析报告</p>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">报告标题</label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">作者</label>
            <input
              type="text"
              value={config.author}
              onChange={(e) => setConfig({ ...config, author: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
      </motion.div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Settings size={14} />
          报告内容
        </h4>
        <div className="space-y-2">
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-400" />
              <span className="text-sm text-slate-300">异常检测详情</span>
            </div>
            <input
              type="checkbox"
              checked={config.includeAnomalies}
              onChange={(e) => setConfig({ ...config, includeAnomalies: e.target.checked })}
              className="w-4 h-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-blue-400" />
              <span className="text-sm text-slate-300">策略标注</span>
            </div>
            <input
              type="checkbox"
              checked={config.includeAnnotations}
              onChange={(e) => setConfig({ ...config, includeAnnotations: e.target.checked })}
              className="w-4 h-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-cyan-400" />
              <span className="text-sm text-slate-300">数据图表</span>
            </div>
            <input
              type="checkbox"
              checked={config.includeCharts}
              onChange={(e) => setConfig({ ...config, includeCharts: e.target.checked })}
              className="w-4 h-4 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-all cursor-pointer">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-emerald-400" />
              <span className="text-sm text-slate-300">包含原始数据</span>
            </div>
            <input
              type="checkbox"
              checked={config.includeRawData}
              onChange={(e) => setConfig({ ...config, includeRawData: e.target.checked })}
              className="w-4 h-4 accent-blue-500"
            />
          </label>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Eye size={14} />
          报告预览
        </h4>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Hash size={10} />
              快照总数
            </div>
            <p className="text-xl font-bold text-white">{summary.totalSnapshots}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Clock size={10} />
              时间跨度
            </div>
            <p className="text-xl font-bold text-white">{formatDuration(summary.timeSpan)}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <AlertTriangle size={10} />
              异常数量
            </div>
            <p className={`text-xl font-bold ${summary.totalAnomalies > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {summary.totalAnomalies}
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <CheckCircle2 size={10} />
              质量评分
            </div>
            <p className={`text-xl font-bold ${getQualityColor(summary.dataQualityScore)}`}>
              {summary.dataQualityScore.toFixed(0)}
            </p>
            <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getQualityBgColor(summary.dataQualityScore)}`}
                style={{ width: `${summary.dataQualityScore}%` }}
              />
            </div>
          </div>
        </div>

        <div
          className="bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: previewHTML }}
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 px-1">导出格式</h4>
        
        <button
          onClick={() => handleExport('html')}
          disabled={isGenerating}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-blue-600/30"
        >
          <FileText size={18} />
          <div className="text-left flex-1">
            <p className="font-medium">导出 HTML 报告</p>
            <p className="text-xs text-blue-200">完整交互式报告，可在浏览器中查看</p>
          </div>
          <Download size={16} />
        </button>

        <button
          onClick={() => handleExport('pdf')}
          disabled={isGenerating}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-purple-600/30"
        >
          <FileImage size={18} />
          <div className="text-left flex-1">
            <p className="font-medium">导出 PDF 报告</p>
            <p className="text-xs text-purple-200">标准PDF格式，适合存档分享</p>
          </div>
          <Download size={16} />
        </button>

        <button
          onClick={() => handleExport('json')}
          disabled={isGenerating}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-xl transition-all"
        >
          <FileJson size={18} />
          <div className="text-left flex-1">
            <p className="font-medium">导出 JSON 数据</p>
            <p className="text-xs text-slate-400">原始结构化数据，供进一步分析</p>
          </div>
          <Download size={16} />
        </button>
      </div>

      {isGenerating && (
        <div className="text-center py-2 text-sm text-slate-400">
          <motion.div
            className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          正在生成报告...
        </div>
      )}

      <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700/30">
        报告生成时间: {formatDateTime(Date.now())}
      </div>
    </div>
  );
};
