import { X, Download, CheckCircle, XCircle, AlertTriangle, FileText, FileDown } from 'lucide-react';
import { PressureChart } from './PressureChart';
import type { CalculationResult, TrainingParams, TrainingSession } from '../../types';
import { downloadReport, downloadPDFReport } from '../../utils/reportGenerator';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult | null;
  params: TrainingParams;
  buildingName: string;
  session?: TrainingSession | null;
  isSessionSaved?: boolean;
  onSaveSession?: () => void;
}

export function ReportModal({
  isOpen,
  onClose,
  result,
  params,
  buildingName,
  session,
  isSessionSaved = false,
  onSaveSession,
}: ReportModalProps) {
  if (!isOpen || !result) return null;

  const handleExportJSON = () => {
    if (session) {
      downloadReport(session);
    }
  };

  const handleExportPDF = () => {
    if (session) {
      downloadPDFReport(session);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">演练评估报告</h2>
              <p className="text-slate-400 text-sm">{buildingName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="flex items-center justify-center mb-6">
            <div
              className={`flex items-center gap-3 px-6 py-3 rounded-xl ${
                result.isValid
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-red-500/20 border border-red-500/30'
              }`}
            >
              {result.isValid ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
              <span
                className={`text-2xl font-bold ${
                  result.isValid ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {result.isValid ? '演练合格' : '演练不合格'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-slate-400 text-sm mb-1">水带长度</div>
              <div className="text-white font-mono text-2xl font-bold">
                {result.totalLength.toFixed(1)}
                <span className="text-sm text-slate-400 ml-1">m</span>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-slate-400 text-sm mb-1">转角数量</div>
              <div className="text-white font-mono text-2xl font-bold">
                {result.cornerCount}
                <span className="text-sm text-slate-400 ml-1">个</span>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-slate-400 text-sm mb-1">压力损失</div>
              <div className="text-red-400 font-mono text-2xl font-bold">
                {result.pressureLoss.toFixed(3)}
                <span className="text-sm text-slate-400 ml-1">MPa</span>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-slate-400 text-sm mb-1">剩余压力</div>
              <div
                className={`font-mono text-2xl font-bold ${
                  result.remainingPressure >= params.minPressure
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {result.remainingPressure.toFixed(3)}
                <span className="text-sm text-slate-400 ml-1">MPa</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">压力变化曲线</h3>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <PressureChart data={result.pressureCurve} minPressure={params.minPressure} />
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                问题汇总
              </h3>
              <div className="space-y-2">
                {result.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg flex items-start gap-3 ${
                      warning.severity === 'error'
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-yellow-500/10 border border-yellow-500/30'
                    }`}
                  >
                    {warning.severity === 'error' ? (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={
                        warning.severity === 'error' ? 'text-red-300' : 'text-yellow-300'
                      }
                    >
                      {warning.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">演练参数</h3>
            <div className="bg-slate-800/50 rounded-xl p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-slate-400 text-sm">水带直径</div>
                <div className="text-white font-mono">{params.hoseDiameter} mm</div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">额定流量</div>
                <div className="text-white font-mono">{params.flowRate} L/s</div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">最大长度限制</div>
                <div className="text-white font-mono">{params.maxHoseLength} m</div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">最小允许压力</div>
                <div className="text-white font-mono">{params.minPressure} MPa</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700">
          {onSaveSession && !isSessionSaved && (
            <button
              onClick={onSaveSession}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
            >
              <FileText className="w-4 h-4" />
              保存记录
            </button>
          )}
          {isSessionSaved && (
            <span className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4" />
              已保存
            </span>
          )}
          <button
            onClick={handleExportJSON}
            disabled={!session}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            <Download className="w-4 h-4" />
            导出JSON
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!session}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            <FileDown className="w-4 h-4" />
            导出PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
