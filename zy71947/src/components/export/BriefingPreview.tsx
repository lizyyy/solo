import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useSequenceStore } from '../../store/useSequenceStore';
import { TimeService } from '../../services/timeService';
import { AnomalyDetector } from '../../services/anomalyDetector';
import {
  FileText,
  Download,
  X,
  AlertOctagon,
  AlertTriangle,
  Zap,
  Clock,
  User,
  Rocket,
  Calendar,
} from 'lucide-react';

interface BriefingPreviewProps {
  show: boolean;
  onClose: () => void;
}

export const BriefingPreview: React.FC<BriefingPreviewProps> = ({ show, onClose }) => {
  const { sequence, detectionResult } = useSequenceStore();
  const previewRef = useRef<HTMLDivElement>(null);

  const criticalCount = detectionResult?.anomalies.filter(a => a.severity === 'CRITICAL').length || 0;
  const warningCount = detectionResult?.anomalies.filter(a => a.severity === 'WARNING').length || 0;
  const infoCount = detectionResult?.anomalies.filter(a => a.severity === 'INFO').length || 0;

  const handleExport = async () => {
    if (!previewRef.current) return;

    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: '#0a0f1a',
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`任务简报_${sequence.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-space-900/90 flex items-center justify-center z-50 p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-3xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyber-cyan/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-cyber-cyan" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">任务简报预览</h3>
                <p className="text-xs text-gray-400">任务主任审阅版</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>导出PDF</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-space-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div
            ref={previewRef}
            className="bg-space-900 border border-space-600/50 rounded-lg overflow-hidden"
          >
            <div className="bg-gradient-to-r from-cyber-cyan/10 via-space-800 to-cyber-cyan/10 p-6 border-b border-space-600/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-8 h-8 text-cyber-cyan" />
                    <h1 className="text-2xl font-bold text-white">航天器任务序列简报</h1>
                  </div>
                  <h2 className="text-cyber-cyan font-mono text-lg mb-4">
                    {sequence.name}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>任务开始: {TimeService.formatTime(sequence.missionStartTime, 'BEIJING')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>总时长: {TimeService.formatDuration(sequence.windows.length > 0 ? sequence.windows[sequence.windows.length - 1].endTime.relativeSeconds : 7200)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>指令数: {sequence.commands.length}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">简报生成时间</div>
                  <div className="text-cyber-cyan font-mono">
                    {new Date().toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-lg text-center">
                  <AlertOctagon className="w-8 h-8 text-cyber-red mx-auto mb-2" />
                  <div className="text-3xl font-bold text-cyber-red font-mono">{criticalCount}</div>
                  <div className="text-xs text-gray-400 mt-1">严重异常</div>
                </div>
                <div className="p-4 bg-cyber-yellow/10 border border-cyber-yellow/30 rounded-lg text-center">
                  <AlertTriangle className="w-8 h-8 text-cyber-yellow mx-auto mb-2" />
                  <div className="text-3xl font-bold text-cyber-yellow font-mono">{warningCount}</div>
                  <div className="text-xs text-gray-400 mt-1">警告</div>
                </div>
                <div className="p-4 bg-cyber-purple/10 border border-cyber-purple/30 rounded-lg text-center">
                  <Zap className="w-8 h-8 text-cyber-purple mx-auto mb-2" />
                  <div className="text-3xl font-bold text-cyber-purple font-mono">{infoCount}</div>
                  <div className="text-xs text-gray-400 mt-1">人工调整</div>
                </div>
              </div>

              {detectionResult && detectionResult.anomalies.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-cyber-yellow" />
                    异常详情与处理建议
                  </h3>
                  <div className="space-y-3">
                    {detectionResult.anomalies.map(anomaly => (
                      <div
                        key={anomaly.id}
                        className={`p-4 rounded-lg border ${
                          anomaly.severity === 'CRITICAL'
                            ? 'bg-cyber-red/10 border-cyber-red/30'
                            : anomaly.severity === 'WARNING'
                            ? 'bg-cyber-yellow/10 border-cyber-yellow/30'
                            : 'bg-cyber-purple/10 border-cyber-purple/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              anomaly.severity === 'CRITICAL'
                                ? 'bg-cyber-red/20'
                                : anomaly.severity === 'WARNING'
                                ? 'bg-cyber-yellow/20'
                                : 'bg-cyber-purple/20'
                            }`}
                          >
                            {anomaly.anomalyType === 'WINDOW_OVERLAP' && (
                              <AlertOctagon className="w-4 h-4 text-cyber-red" />
                            )}
                            {anomaly.anomalyType === 'TELEMETRY_MISSING' && (
                              <AlertTriangle className="w-4 h-4 text-cyber-yellow" />
                            )}
                            {anomaly.anomalyType === 'MANUAL_INSERT' && (
                              <Zap className="w-4 h-4 text-cyber-purple" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs font-mono font-semibold ${
                                  anomaly.severity === 'CRITICAL'
                                    ? 'text-cyber-red'
                                    : anomaly.severity === 'WARNING'
                                    ? 'text-cyber-yellow'
                                    : 'text-cyber-purple'
                                }`}
                              >
                                [{anomaly.severity === 'CRITICAL' ? '严重' : anomaly.severity === 'WARNING' ? '警告' : '提示'}]
                              </span>
                              <span className="text-white text-sm font-medium">
                                {AnomalyDetector.getAnomalyLabel(anomaly.anomalyType)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 mb-2">{anomaly.description}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-500">
                                时间: {TimeService.formatRelative(anomaly.relativeTimeSeconds)}
                              </span>
                            </div>
                            <div className="mt-2 p-2 bg-space-800/50 rounded text-xs">
                              <span className="text-cyber-cyan">处理建议：</span>
                              <span className="text-gray-400">{anomaly.suggestion}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-cyber-cyan" />
                  时间窗口概览
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {sequence.windows.slice(0, 4).map(window => (
                    <div
                      key={window.id}
                      className="p-3 bg-space-800/50 rounded-lg border border-space-600/30"
                    >
                      <div className="text-white text-sm font-medium mb-1">{window.name}</div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <div>开始: {TimeService.formatRelative(window.startTime.relativeSeconds)}</div>
                        <div>结束: {TimeService.formatRelative(window.endTime.relativeSeconds)}</div>
                        <div>指令数: {window.commands.length}</div>
                      </div>
                    </div>
                  ))}
                  {sequence.windows.length > 4 && (
                    <div className="p-3 bg-space-800/50 rounded-lg border border-dashed border-space-600/30 flex items-center justify-center">
                      <span className="text-gray-500 text-sm">+{sequence.windows.length - 4} 更多窗口</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-space-600/50">
                <div className="text-center text-xs text-gray-500">
                  <p>本简报由任务序列回放系统自动生成</p>
                  <p className="mt-1">如有疑问，请联系总体调度岗</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
