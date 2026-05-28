import { useState } from 'react';
import { FileSpreadsheet, FileText, FileJson, Download, Clock, FileBarChart, Grid3X3, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '@/store';
import type { ReportFormat, ContentType } from '@/types';

const FORMAT_OPTIONS: { value: ReportFormat; label: string; icon: any; color: string }[] = [
  { value: 'EXCEL', label: 'Excel', icon: FileSpreadsheet, color: 'text-success-600 bg-success-50 border-success-200' },
  { value: 'PDF', label: 'PDF', icon: FileText, color: 'text-danger-600 bg-danger-50 border-danger-200' },
  { value: 'JSON', label: 'JSON', icon: FileJson, color: 'text-navy-600 bg-navy-50 border-navy-200' },
];

const CONTENT_OPTIONS: { value: ContentType; label: string; description: string; icon: any }[] = [
  { value: 'FULL_REPORT', label: '完整分析报告', description: '包含转移矩阵、状态预测、异常诊断和原始数据', icon: FileBarChart },
  { value: 'MATRIX_ONLY', label: '转移矩阵数据', description: '仅包含转移概率矩阵和样本量数据', icon: Grid3X3 },
  { value: 'FORECAST_ONLY', label: '状态预测结果', description: '仅包含多步状态预测和置信区间', icon: TrendingUp },
  { value: 'ANOMALY_ONLY', label: '异常诊断报告', description: '仅包含异常检测结果和处理建议', icon: AlertTriangle },
];

export default function ReportsPage() {
  const { reportBatches, generateReport, isLoading, transitionMatrix } = useAppStore();
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('EXCEL');
  const [selectedContent, setSelectedContent] = useState<ContentType>('FULL_REPORT');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      generateReport(selectedFormat, selectedContent);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFormatIcon = (format: ReportFormat) => {
    const opt = FORMAT_OPTIONS.find(f => f.value === format);
    return opt ? opt.icon : FileText;
  };

  const getContentLabel = (content: ContentType) => {
    const opt = CONTENT_OPTIONS.find(c => c.value === content);
    return opt ? opt.label : content;
  };

  if (isLoading || !transitionMatrix) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-navy-500">
          <div className="text-4xl mb-2 animate-pulse">📊</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="section-title">报告导出中心</h2>
        <p className="section-subtitle">
          按批次导出分析报告，自动生成批次号避免文件混淆，支持多种格式和内容类型
        </p>
      </div>

      <div className="bg-gradient-to-r from-navy-50 to-white border-l-4 border-navy-500 rounded-r-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-navy-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-navy-900 mb-1">文件命名规则</h4>
            <p className="text-sm text-navy-600 font-mono">
              批次号_内容类型.后缀 &nbsp;&nbsp;例如：<span className="font-bold">2026-W22-BATCH-003_完整分析报告.xlsx</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              选择导出格式
            </h3>
            <p className="text-sm text-navy-500 mt-0.5">
              根据使用场景选择合适的文件格式
            </p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-3">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedFormat(opt.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    selectedFormat === opt.value
                      ? `${opt.color} border-current shadow-md`
                      : 'border-navy-100 bg-white hover:border-navy-300'
                  }`}
                >
                  <opt.icon className={`w-8 h-8 mx-auto mb-2 ${
                    selectedFormat === opt.value ? '' : 'text-navy-400'
                  }`} />
                  <div className={`font-semibold ${
                    selectedFormat === opt.value ? '' : 'text-navy-600'
                  }`}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold text-navy-900">
              选择内容类型
            </h3>
            <p className="text-sm text-navy-500 mt-0.5">
              选择需要导出的分析内容模块
            </p>
          </div>
          <div className="card-body space-y-3">
            {CONTENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedContent(opt.value)}
                className={`w-full p-3 rounded-xl border-2 transition-all flex items-start gap-3 text-left ${
                  selectedContent === opt.value
                    ? 'bg-navy-50 border-navy-500'
                    : 'border-navy-100 bg-white hover:border-navy-300'
                }`}
              >
                <opt.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  selectedContent === opt.value ? 'text-navy-600' : 'text-navy-400'
                }`} />
                <div>
                  <div className={`font-semibold ${
                    selectedContent === opt.value ? 'text-navy-900' : 'text-navy-700'
                  }`}>{opt.label}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{opt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-navy-900">
              导出预览
            </h3>
            <p className="text-sm text-navy-500 mt-0.5">
              确认导出设置后点击生成报告
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-primary flex items-center gap-2"
          >
            <Download className={`w-4 h-4 ${isGenerating ? 'animate-bounce' : ''}`} />
            {isGenerating ? '生成中...' : '生成并下载'}
          </button>
        </div>
        <div className="card-body">
          <div className="bg-gradient-to-br from-navy-50 to-navy-100 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-sm">
                {(() => {
                  const Icon = getFormatIcon(selectedFormat);
                  return <Icon className="w-8 h-8 text-navy-600" />;
                })()}
              </div>
              <div>
                <div className="font-mono text-lg font-bold text-navy-900">
                  2026-WXX-BATCH-XXX_{getContentLabel(selectedContent)}.{selectedFormat.toLowerCase()}
                </div>
                <div className="text-sm text-navy-500 mt-1">
                  格式：{selectedFormat} · 内容：{getContentLabel(selectedContent)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3">
                <div className="text-navy-500">转移矩阵</div>
                <div className="font-bold text-navy-900">
                  {selectedContent === 'FULL_REPORT' || selectedContent === 'MATRIX_ONLY' ? '✓' : '-'}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-navy-500">状态预测</div>
                <div className="font-bold text-navy-900">
                  {selectedContent === 'FULL_REPORT' || selectedContent === 'FORECAST_ONLY' ? '✓' : '-'}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-navy-500">异常诊断</div>
                <div className="font-bold text-navy-900">
                  {selectedContent === 'FULL_REPORT' || selectedContent === 'ANOMALY_ONLY' ? '✓' : '-'}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-navy-500">原始数据</div>
                <div className="font-bold text-navy-900">
                  {selectedContent === 'FULL_REPORT' ? '✓' : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-display text-lg font-semibold text-navy-900">
            历史导出批次
          </h3>
          <p className="text-sm text-navy-500 mt-0.5">
            查看和重新下载已生成的报告
          </p>
        </div>
        <div className="card-body">
          {reportBatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📂</div>
              <h4 className="font-semibold text-navy-900 mb-1">暂无导出记录</h4>
              <p className="text-sm text-navy-500">
                生成的报告将显示在这里，按生成时间倒序排列
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportBatches.map(batch => {
                const Icon = getFormatIcon(batch.format);
                return (
                  <div
                    key={batch.batchId}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-navy-100 hover:border-navy-300 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-navy-50 rounded-lg flex items-center justify-center">
                        <Icon className="w-6 h-6 text-navy-600" />
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-navy-900">
                          {batch.name}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-navy-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(batch.generatedAt)}
                          </span>
                          <span>批次：{batch.batchId}</span>
                          <span>生成者：{batch.generatedBy}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = batch.downloadUrl;
                        a.download = batch.name;
                        a.click();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-navy-600 bg-navy-50 hover:bg-navy-100 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      下载
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
