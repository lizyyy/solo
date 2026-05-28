
import React from 'react';
import { GradingReport } from '../types';
import { formatDateTime } from '../utils/colorMath';
import { formatParamsForDisplay } from '../utils/reportGenerator';
import { getGradeColor, getIssueIcon, getIssueName } from '../utils/scoring';
import { X, Download, FileText, CheckCircle } from 'lucide-react';

interface ReportModalProps {
  report: GradingReport | null;
  onClose: () => void;
  onExportPDF: () => void;
  onExportImage: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  report,
  onClose,
  onExportPDF,
  onExportImage,
}) => {
  if (!report) return null;

  const gradeColor = getGradeColor(report.score.grade);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl">
        <div className="sticky top-0 flex items-center justify-between p-4 bg-gray-900/95 border-b border-gray-700 z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span
              className="text-lg font-medium text-gray-100"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              调色报告
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportImage}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出图片
            </button>
            <button
              onClick={onExportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-6">
            <div
              className="flex-shrink-0 w-32 h-32 rounded-xl flex flex-col items-center justify-center"
              style={{
                backgroundColor: `${gradeColor}15`,
                border: `2px solid ${gradeColor}`,
                boxShadow: `0 0 30px ${gradeColor}33`,
              }}
            >
              <span
                className="text-5xl font-bold"
                style={{
                  color: gradeColor,
                  fontFamily: 'Orbitron, sans-serif',
                  textShadow: `0 0 20px ${gradeColor}`,
                }}
              >
                {report.score.grade}
              </span>
              <span className="text-sm text-gray-400 mt-1">
                {report.score.overall.toFixed(1)} / 100
              </span>
            </div>

            <div className="flex-1">
              <div className="text-sm text-gray-400 mb-1">生成时间</div>
              <div className="text-gray-200 font-mono mb-4">
                {formatDateTime(report.timestamp)}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <ScoreStat label="亮度" value={report.score.brightness} color="#00d4ff" />
                <ScoreStat label="色彩" value={report.score.color} color="#ff6b35" />
                <ScoreStat label="细节" value={report.score.detail} color="#00ff88" />
              </div>
            </div>
          </div>

          {report.comparisonScreenshot && (
            <div>
              <div className="text-sm text-gray-400 mb-2">对比截图</div>
              <div className="rounded-lg overflow-hidden border border-gray-700">
                <img
                  src={report.comparisonScreenshot}
                  alt="Comparison"
                  className="w-full"
                />
              </div>
            </div>
          )}

          <div>
            <div className="text-sm text-gray-400 mb-2">最终参数</div>
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">曝光: </span>
                  <span className="text-cyan-400 font-mono">
                    {report.finalParams.exposure.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">色温: </span>
                  <span className="text-orange-400 font-mono">
                    {report.finalParams.temperature}K
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">LUT: </span>
                  <span className="text-purple-400 font-mono">
                    {report.finalParams.lutId || '无'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">LUT 强度: </span>
                  <span className="text-purple-400 font-mono">
                    {report.finalParams.lutIntensity}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {report.score.issues.length > 0 && (
            <div>
              <div className="text-sm text-gray-400 mb-2">检测到的问题</div>
              <div className="space-y-2">
                {report.score.issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      issue.severity === 'error'
                        ? 'bg-red-900/20 border border-red-700/50'
                        : 'bg-yellow-900/20 border border-yellow-700/50'
                    }`}
                  >
                    <span className="text-2xl">{getIssueIcon(issue.type)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-200">
                        {getIssueName(issue.type)}
                      </div>
                      <div className="text-sm text-gray-400">{issue.message}</div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        issue.severity === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {issue.severity === 'error' ? '严重' : '警告'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm text-gray-400 mb-2">
              操作历史 ({report.history.length} 步)
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {report.history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-2 text-xs bg-gray-800/30 rounded"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-700 rounded text-gray-300">
                    {index + 1}
                  </span>
                  <span className="w-20 text-gray-400 font-mono">
                    {formatDateTime(entry.timestamp).split(' ')[1]}
                  </span>
                  <span className="w-16 text-cyan-400">{entry.actionType}</span>
                  <span className="flex-1 text-gray-500 truncate font-mono">
                    {formatParamsForDisplay(entry.params)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 p-4 bg-gray-900/95 border-t border-gray-700">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <CheckCircle className="w-4 h-4 text-green-400" />
            报告已保存到本地存储
          </div>
        </div>
      </div>
    </div>
  );
};

interface ScoreStatProps {
  label: string;
  value: number;
  color: string;
}

const ScoreStat: React.FC<ScoreStatProps> = ({ label, value, color }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-xl font-bold font-mono" style={{ color }}>
      {value.toFixed(1)}
    </div>
    <div className="h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  </div>
);
