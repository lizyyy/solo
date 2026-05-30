import { BatchReport, FunctionCard } from '../types';
import {
  formatReportDate,
  getReportSummary,
  generateReportFileName,
  exportBatchReport,
} from '../utils/reportGenerator';
import { getExceptionTypeLabel, getSeverityColor } from '../utils/obstacleDetector';
import { FileText, Download, Calendar, Award, Zap, AlertTriangle } from 'lucide-react';

interface ReportCardProps {
  report: BatchReport;
  functionCards: FunctionCard[];
}

export const ReportCard = ({ report, functionCards }: ReportCardProps) => {
  const summary = getReportSummary(report);

  const handleExport = async (format: 'json' | 'pdf') => {
    await exportBatchReport(report, functionCards, format);
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-600/20 to-purple-600/20 px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-orbitron">
                批次报告
              </h3>
              <p className="text-sm text-cyan-400 font-mono">{report.batchId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('json')}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors flex items-center gap-2"
              title="导出 JSON"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500 transition-colors flex items-center gap-2"
              title="导出 PDF"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>{formatReportDate(report.startTime)}</span>
            <span className="text-slate-600">~</span>
            <span>{formatReportDate(report.endTime)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">总记录</p>
            <p className="text-2xl font-bold text-white font-orbitron">
              {summary.total}
            </p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/30">
            <p className="text-xs text-green-400 mb-1">正常率</p>
            <p className="text-2xl font-bold text-green-400 font-orbitron">
              {summary.normalRate}
            </p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/30">
            <p className="text-xs text-red-400 mb-1">异常率</p>
            <p className="text-2xl font-bold text-red-400 font-orbitron">
              {summary.exceptionRate}
            </p>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-3 text-center border border-yellow-500/30">
            <p className="text-xs text-yellow-400 mb-1">待确认</p>
            <p className="text-2xl font-bold text-yellow-400 font-orbitron">
              {summary.pendingRate}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-slate-400">最终得分</span>
            </div>
            <p className="text-3xl font-bold text-yellow-400 font-orbitron">
              {report.score}
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">最大连击</span>
            </div>
            <p className="text-3xl font-bold text-purple-400 font-orbitron">
              {report.maxCombo}
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">使用函数卡</span>
            </div>
            <p className="text-3xl font-bold text-cyan-400 font-orbitron">
              {report.functionCards.length}
            </p>
          </div>
        </div>

        {report.functionCards.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2">使用的函数卡</p>
            <div className="flex flex-wrap gap-2">
              {report.functionCards.map((cardId) => {
                const card = functionCards.find((c) => c.id === cardId);
                return (
                  <span
                    key={cardId}
                    className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs"
                  >
                    {card?.name || cardId}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {report.exceptions.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              异常分析
            </p>
            <div className="space-y-2">
              {report.exceptions.map((exc, index) => {
                const severityColor = getSeverityColor(
                  exc.severity as 'low' | 'medium' | 'high'
                );
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-700/50"
                  >
                    <span className="text-sm text-slate-300">
                      {getExceptionTypeLabel(exc.type)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm font-bold"
                        style={{ color: severityColor }}
                      >
                        {exc.count} 次
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: `${severityColor}20`,
                          color: severityColor,
                        }}
                      >
                        {exc.severity === 'low'
                          ? '低危'
                          : exc.severity === 'medium'
                          ? '中危'
                          : '高危'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500 pt-3 border-t border-slate-700/50">
          生成时间: {formatReportDate(report.generatedAt)} · 生成者:{' '}
          {report.generatedBy}
        </div>
      </div>
    </div>
  );
};
