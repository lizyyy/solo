import React, { useState, useEffect } from 'react';
import { FileText, X, Download, Trophy, AlertCircle, CheckCircle2, Clock, Wrench } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { generateReport, downloadReport } from '../utils/reportGenerator';
import { ReportData } from '../types';
import { cn } from '../utils/cn';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
  const { selectedScene, errors, operations, timeSteps, startTime, currentStep } = useSimulationStore();
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    if (isOpen && selectedScene) {
      const record = {
        id: 'record-' + Date.now(),
        sceneName: selectedScene.name,
        startTime: startTime,
        endTime: Date.now(),
        timeSteps: timeSteps,
        fanOperations: operations,
        errors: errors,
        finalScore: 0
      };
      const generatedReport = generateReport(record as any);
      setReport(generatedReport);
    }
  }, [isOpen, selectedScene, errors, operations, timeSteps, startTime]);

  const handleDownload = (format: 'json' | 'txt') => {
    if (report) {
      downloadReport(report, format);
    }
  };

  if (!isOpen || !report) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-600';
    if (score >= 60) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-750">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <FileText size={20} className="text-orange-400" />
            演练报告
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload('txt')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              <Download size={14} />
              TXT
            </button>
            <button
              onClick={() => handleDownload('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              <Download size={14} />
              JSON
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-1">
              <div className={cn(
                "rounded-2xl p-6 text-center bg-gradient-to-br",
                getScoreBg(report.summary.score)
              )}>
                <Trophy size={32} className="mx-auto mb-2 text-white/80" />
                <p className="text-white/70 text-sm mb-1">综合得分</p>
                <p className={cn("text-5xl font-bold", getScoreColor(report.summary.score))}>
                  {report.summary.score}
                </p>
                <p className="text-white/60 text-xs mt-2">满分 100 分</p>
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <StatCard
                icon={<Clock size={18} />}
                label="演练时长"
                value={`${report.summary.totalTime} 秒`}
                color="text-blue-400"
              />
              <StatCard
                icon={<CheckCircle2 size={18} />}
                label="时间步数"
                value={`${report.summary.totalSteps} 步`}
                color="text-green-400"
              />
              <StatCard
                icon={<AlertCircle size={18} />}
                label="问题总数"
                value={`${report.summary.errorCount} 个`}
                color={report.summary.errorCount > 0 ? "text-red-400" : "text-gray-400"}
              />
              <StatCard
                icon={<Wrench size={18} />}
                label="操作次数"
                value={`${report.operations.length} 次`}
                color="text-amber-400"
              />
            </div>
          </div>

          {report.operations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Wrench size={16} className="text-amber-400" />
                操作记录
              </h3>
              <div className="bg-gray-700/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                <div className="space-y-2">
                  {report.operations.slice(-10).map((op, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">步骤 {op.step}</span>
                      <span className="text-gray-300">
                        {op.action === 'toggle' ? (op.value ? '开启' : '关闭') + ' 风机' :
                         op.action === 'direction' ? '切换方向' :
                         `调节功率 ${op.value}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-blue-400" />
                改进建议
              </h3>
              <div className="space-y-2">
                {report.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                  >
                    <span className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-gray-300 text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className="bg-gray-700/30 rounded-xl p-4">
    <div className={cn("mb-2", color)}>{icon}</div>
    <p className="text-gray-500 text-xs mb-1">{label}</p>
    <p className={cn("text-lg font-bold", color)}>{value}</p>
  </div>
);
