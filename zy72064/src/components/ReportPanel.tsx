import { useState, useEffect, useCallback } from 'react';
import { FileText, Copy, CheckCircle, Clock, AlertTriangle, FileJson, FileSpreadsheet } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ANOMALY_LABELS } from '@/types';
import type { AnalysisReport } from '@/types';

export function ReportPanel() {
  const { generateReport, exportData, currentOperator, params, points } = useStore();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      const newReport = generateReport();
      setReport(newReport);
      setIsGenerating(false);
    }, 300);
  }, [generateReport]);

  useEffect(() => {
    handleGenerate();
  }, [params, points, handleGenerate]);

  const handleExport = (format: 'json' | 'csv') => {
    const content = exportData(format);
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `交响乐团站位声场_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (report) {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">正在生成报告...</div>
      </div>
    );
  }

  const { summary, judgmentProcess, params: reportParams } = report;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-700 font-serif flex items-center gap-2">
          <FileText className="w-5 h-5" />
          分析报告
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn btn-outline flex items-center gap-1 text-xs"
          >
            {isGenerating ? (
              <>
                <Clock className="w-3 h-3 animate-spin" />
                生成中
              </>
            ) : (
              '刷新报告'
            )}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-lg p-4 border border-primary-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary-700">{summary.totalPoints}</div>
            <div className="text-xs text-gray-500">总点数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{summary.normalCount}</div>
            <div className="text-xs text-gray-500">正常</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{summary.pendingCount}</div>
            <div className="text-xs text-gray-500">待确认</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{summary.anomalyCount}</div>
            <div className="text-xs text-gray-500">异常</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700">异常分布</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(summary.anomalies).map(([type, count]) => {
            if (count === 0) return null;
            return (
              <div
                key={type}
                className="flex items-center justify-between p-2 bg-orange-50 rounded text-sm"
              >
                <span className="text-orange-700">{ANOMALY_LABELS[type as keyof typeof ANOMALY_LABELS]}</span>
                <span className="font-bold text-orange-600">{count}</span>
              </div>
            );
          })}
          {summary.anomalyCount === 0 && (
            <div className="col-span-2 p-3 bg-green-50 rounded text-center text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              未检测到异常
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">判断过程</div>
        <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto scrollbar-thin">
          <div className="space-y-2">
            {judgmentProcess.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs text-gray-600"
              >
                <span className="text-primary-500 font-mono flex-shrink-0 mt-0.5">
                  [{index + 1}]
                </span>
                <span className={step.includes('检测到') || step.includes('异常') ? 'text-orange-600' : ''}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">分析参数</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-500">频率范围</span>
            <span className="text-gray-700">{reportParams.frequencyMin}-{reportParams.frequencyMax}Hz</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-500">采样精度</span>
            <span className="text-gray-700">{reportParams.sampleRate.toLocaleString()}Hz</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-500">声场阈值</span>
            <span className="text-gray-700">{reportParams.soundFieldThreshold}dB</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-500">主坐标系</span>
            <span className="text-gray-700">{reportParams.coordinateSystem}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="text-sm font-medium text-gray-700 mb-3">导出数据</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleExport('json')}
            className="btn btn-outline flex flex-col items-center justify-center gap-1 py-3"
          >
            <FileJson className="w-5 h-5" />
            <span className="text-xs">JSON</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-outline flex flex-col items-center justify-center gap-1 py-3"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-xs">CSV</span>
          </button>
          <button
            onClick={handleCopy}
            className="btn btn-outline flex flex-col items-center justify-center gap-1 py-3"
          >
            {copied ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            <span className="text-xs">{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          导出内容包含参数配置、点位数据、异常原因和判断过程，确保报告与明细一致。
        </p>
      </div>

      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-700">
            <div className="font-medium mb-1">导出说明</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>导出文件将包含"交响乐团站位声场"完整判断过程</li>
              <li>坐标系不一致的点位会明确标注，不会硬画到主坐标系</li>
              <li>GIS旧口径数据会单独标记来源</li>
              <li>当前操作人：{currentOperator}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
