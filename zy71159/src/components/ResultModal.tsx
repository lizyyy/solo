import { useState } from 'react';
import { X, Download, Play, RotateCcw, Trophy, AlertTriangle } from 'lucide-react';
import { useGame } from '../hooks/useGameState';
import { generateReport, exportReportToText } from '../game/logic';
import { CROP_INFO } from '../game/types';

interface ResultModalProps {
  onClose: () => void;
  onReplay: () => void;
}

export function ResultModal({ onClose, onReplay }: ResultModalProps) {
  const { state, dispatch } = useGame();
  const [copied, setCopied] = useState(false);

  const report = generateReport(state);
  const reportText = exportReportToText(report);

  const handleExport = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `灌溉报告_${report.levelName}_${new Date().toLocaleDateString('zh-CN')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestart = () => {
    dispatch({ type: 'RESTART' });
    onClose();
  };

  const isWin = state.status === 'won';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className={`p-6 ${isWin ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-orange-600'} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isWin ? (
                <Trophy className="w-10 h-10" />
              ) : (
                <AlertTriangle className="w-10 h-10" />
              )}
              <div>
                <h2 className="text-2xl font-bold">
                  {isWin ? '🎉 灌溉成功！' : '😢 灌溉失败'}
                </h2>
                <p className="text-white/80">{report.levelName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-amber-50 rounded-xl">
              <p className="text-3xl font-bold text-amber-600">{report.finalScore}</p>
              <p className="text-sm text-amber-700">最终得分</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-3xl font-bold text-blue-600">{report.totalRounds}</p>
              <p className="text-sm text-blue-700">使用回合</p>
            </div>
            <div className="text-center p-4 bg-cyan-50 rounded-xl">
              <p className="text-3xl font-bold text-cyan-600">{report.waterUsage.total}</p>
              <p className="text-sm text-cyan-700">总用水量</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3">地块灌溉结果</h3>
            <div className="space-y-2">
              {report.plotResults.map((result, index) => {
                const cropInfo = CROP_INFO[result.crop];
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.status === 'success'
                        ? 'bg-green-50 border border-green-200'
                        : result.status === 'overwatered'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-amber-50 border border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cropInfo.emoji}</span>
                      <span className="font-medium">{cropInfo.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {result.waterReceived} / {result.waterNeeded}
                      </p>
                      <p
                        className={`text-xs ${
                          result.status === 'success'
                            ? 'text-green-600'
                            : result.status === 'overwatered'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {result.status === 'success'
                          ? '✓ 达标'
                          : result.status === 'overwatered'
                          ? '✗ 过度灌溉'
                          : '✗ 灌溉不足'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {report.failureReasons.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3">失败原因分析</h3>
              <div className="space-y-2">
                {report.failureReasons.map((reason, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700"
                  >
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-bold text-gray-800 mb-3">结算报告</h3>
            <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-48 font-mono">
              {reportText}
            </pre>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              重新开始
            </button>
            <button
              onClick={onReplay}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-5 h-5" />
              历史回放
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              {copied ? '已复制!' : '复制'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              导出报告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
