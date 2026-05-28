import React, { useState } from 'react';
import { FileText, Download, Copy, Check } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';
import {
  exportToJSON,
  exportToCSV,
  exportReportToJSON,
  generateReadableSummary,
  downloadFile,
} from '../utils/importExport';

export function ReportExport() {
  const { report, points, equipment, cableSpec, params } = useHoistStore();
  const [copied, setCopied] = useState(false);

  if (!report) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">校核报告</h3>
        </div>
        <div className="text-center py-8 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>请先点击"开始计算"生成报告</p>
        </div>
      </div>
    );
  }

  const summary = generateReadableSummary(report);

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportData = () => {
    const json = exportToJSON(points, equipment, cableSpec, params);
    downloadFile(json, 'hoist-load-data.json', 'application/json');
  };

  const handleExportReport = () => {
    const json = exportReportToJSON(report);
    downloadFile(json, 'hoist-load-report.json', 'application/json');
  };

  const handleExportCSV = () => {
    const csv = exportToCSV(report.pointResults);
    downloadFile(csv, 'hoist-load-results.csv', 'text/csv;charset=utf-8');
  };

  const handleExportSummary = () => {
    downloadFile(summary, 'hoist-load-summary.txt', 'text/plain;charset=utf-8');
  };

  const getStatusBadgeClass = () => {
    switch (report.summary.overallStatus) {
      case 'safe':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'danger':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const getStatusText = () => {
    switch (report.summary.overallStatus) {
      case 'safe':
        return '安全 ✓';
      case 'warning':
        return '存在警告 ⚠';
      case 'danger':
        return '存在危险 ✗';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">校核报告</h3>
        <div className="ml-auto">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadgeClass()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white font-mono">
            {report.summary.totalPoints}
          </div>
          <div className="text-xs text-slate-400">吊点数量</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white font-mono">
            {report.summary.totalEquipment}
          </div>
          <div className="text-xs text-slate-400">设备总数</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {report.summary.totalWeight.toFixed(1)}
          </div>
          <div className="text-xs text-slate-400">总重量 (kg)</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400 font-mono">
            {report.summary.maxCableForce.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400">最大绳力 (kN)</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div
            className={`text-2xl font-bold font-mono ${
              report.summary.minSafetyRatio >= 5
                ? 'text-green-400'
                : report.summary.minSafetyRatio >= 3
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}
          >
            {report.summary.minSafetyRatio.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400">最小安全系数</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white font-medium">人读摘要</h4>
          <div className="flex gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleExportSummary}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              <Download className="w-3 h-3" />
              导出TXT
            </button>
          </div>
        </div>
        <pre className="bg-slate-900 rounded-lg p-4 text-xs text-slate-300 max-h-64 overflow-auto font-mono whitespace-pre-wrap">
          {summary}
        </pre>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-white font-medium mb-3">导出数据</h4>
        <div className="flex gap-3">
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            原始数据 (JSON)
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            完整报告 (JSON)
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            结果明细 (CSV)
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          导出文件包含所有计算明细，便于导入Excel或其他工具继续处理
        </p>
      </div>
    </div>
  );
}
