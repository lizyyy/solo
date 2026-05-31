import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSequenceStore } from '../../store/useSequenceStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { TimeService } from '../../services/timeService';
import { AnomalyDetector } from '../../services/anomalyDetector';
import { payloadColors, commandTypeLabels } from '../../mock/sampleData';
import {
  Info,
  Clock,
  User,
  FileText,
  AlertTriangle,
  Zap,
  AlertOctagon,
  X,
  ChevronRight,
  Calendar,
  ArrowRightLeft,
  Undo2,
} from 'lucide-react';

export const DetailPanel: React.FC = () => {
  const { sequence, selectedCommandId, selectCommand, undoLastAdjustment, recalculator } =
    useSequenceStore();
  const { showDetailPanel, toggleDetailPanel } = usePlaybackStore();

  const command = selectedCommandId
    ? sequence.commands.find(c => c.id === selectedCommandId)
    : null;

  const canUndo = command?.isManualInsert || command?.adjustments.length > 0;
  const canUndoGlobal = recalculator?.canUndo() ?? false;

  if (!showDetailPanel) {
    return (
      <motion.button
        initial={{ x: 300 }}
        animate={{ x: 0 }}
        onClick={toggleDetailPanel}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-space-800/90 border border-l-0 border-space-600 rounded-l p-2 hover:bg-space-700 transition-colors"
      >
        <Info className="w-5 h-5 text-cyber-cyan" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ x: 350 }}
      animate={{ x: 0 }}
      exit={{ x: 350 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-80 bg-space-900/95 border-l border-space-600/50 flex flex-col h-full backdrop-blur-sm"
    >
      <div className="p-4 border-b border-space-600/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-cyber-cyan" />
            <h2 className="text-sm font-semibold text-cyber-cyan font-mono">指令详情</h2>
          </div>
          <button
            onClick={toggleDetailPanel}
            className="p-1 hover:bg-space-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {command ? (
            <motion.div
              key={command.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 space-y-4"
            >
              <div
                className="p-3 rounded border"
                style={{
                  backgroundColor: `${payloadColors[command.payloadName] || '#64ffda'}10`,
                  borderColor: `${payloadColors[command.payloadName] || '#64ffda'}50`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: payloadColors[command.payloadName] || '#64ffda' }}
                  />
                  <span
                    className="text-xs font-mono"
                    style={{ color: payloadColors[command.payloadName] || '#64ffda' }}
                  >
                    {command.payloadName}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{command.commandName}</h3>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-space-700 rounded text-[10px] text-gray-300 font-mono">
                    {commandTypeLabels[command.commandType]}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      command.status === 'SCHEDULED'
                        ? 'bg-cyber-cyan/20 text-cyber-cyan'
                        : 'bg-space-700 text-gray-400'
                    }`}
                  >
                    {command.status === 'SCHEDULED' ? '已排程' : command.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  时间信息
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                    <span className="text-gray-500 w-16">UTC:</span>
                    <span className="font-mono text-cyber-cyan">
                      {TimeService.formatTime(command.time.utc, 'UTC')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                    <span className="text-gray-500 w-16">北京时:</span>
                    <span className="font-mono text-cyber-cyan">
                      {TimeService.formatTime(command.time.beijing, 'BEIJING')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <ArrowRightLeft className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                    <span className="text-gray-500 w-16">相对时:</span>
                    <span className="font-mono text-cyber-cyan">
                      {TimeService.formatRelative(command.time.relativeSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-500 w-16">持续:</span>
                    <span className="font-mono">
                      {TimeService.formatDuration(command.durationSeconds)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  安排原因
                </h4>
                <div className="p-3 bg-space-800/50 rounded text-sm text-gray-300 leading-relaxed">
                  <FileText className="w-4 h-4 text-gray-500 inline-block mr-2" />
                  {command.reason}
                </div>
              </div>

              {command.prerequisites.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    前置依赖
                  </h4>
                  <div className="space-y-1">
                    {command.prerequisites.map(prereqId => {
                      const prereqCmd = sequence.commands.find(c => c.id === prereqId);
                      return (
                        <button
                          key={prereqId}
                          onClick={() => selectCommand(prereqId)}
                          className="w-full flex items-center gap-2 p-2 bg-space-800/50 rounded text-sm hover:bg-space-700/50 transition-colors text-left"
                        >
                          <ChevronRight className="w-3 h-3 text-cyber-cyan" />
                          <span className="text-gray-300 truncate">
                            {prereqCmd?.commandName || prereqId}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {command.anomaly && (
                <div
                  className={`p-3 rounded border ${
                    command.anomaly.severity === 'CRITICAL'
                      ? 'bg-cyber-red/10 border-cyber-red/50'
                      : command.anomaly.severity === 'WARNING'
                      ? 'bg-cyber-yellow/10 border-cyber-yellow/50'
                      : 'bg-cyber-purple/10 border-cyber-purple/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {command.anomaly.anomalyType === 'WINDOW_OVERLAP' && (
                      <AlertOctagon className="w-4 h-4 text-cyber-red" />
                    )}
                    {command.anomaly.anomalyType === 'TELEMETRY_MISSING' && (
                      <AlertTriangle className="w-4 h-4 text-cyber-yellow" />
                    )}
                    {command.anomaly.anomalyType === 'MANUAL_INSERT' && (
                      <Zap className="w-4 h-4 text-cyber-purple" />
                    )}
                    <span
                      className={`text-xs font-semibold font-mono ${
                        command.anomaly.severity === 'CRITICAL'
                          ? 'text-cyber-red'
                          : command.anomaly.severity === 'WARNING'
                          ? 'text-cyber-yellow'
                          : 'text-cyber-purple'
                      }`}
                    >
                      {AnomalyDetector.getAnomalyLabel(command.anomaly.anomalyType)}
                    </span>
                    <span
                      className={`ml-auto px-2 py-0.5 rounded text-[10px] font-mono ${
                        command.anomaly.severity === 'CRITICAL'
                          ? 'bg-cyber-red/20 text-cyber-red'
                          : command.anomaly.severity === 'WARNING'
                          ? 'bg-cyber-yellow/20 text-cyber-yellow'
                          : 'bg-cyber-purple/20 text-cyber-purple'
                      }`}
                    >
                      {command.anomaly.severity === 'CRITICAL'
                        ? '严重'
                        : command.anomaly.severity === 'WARNING'
                        ? '警告'
                        : '提示'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{command.anomaly.description}</p>
                  <div className="pt-2 border-t border-space-600/50">
                    <p className="text-xs text-gray-400">
                      <span className="text-cyber-cyan">建议：</span>
                      {command.anomaly.suggestion}
                    </p>
                  </div>
                </div>
              )}

              {command.adjustments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    调整历史
                  </h4>
                  <div className="space-y-2">
                    {command.adjustments.map(adj => (
                      <div
                        key={adj.id}
                        className="p-3 bg-cyber-purple/10 border border-cyber-purple/30 rounded"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-cyber-purple" />
                          <span className="text-xs text-cyber-purple font-mono">
                            {adj.adjustType === 'INSERT'
                              ? '人工插入'
                              : adj.adjustType === 'MOVE'
                              ? '时间调整'
                              : '删除'}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-300">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-gray-500" />
                            <span>调整人: {adj.operator}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-gray-500" />
                            <span>时间: {adj.adjustTime.toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-gray-400 pl-5">原因: {adj.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(canUndo || canUndoGlobal) && (
                <div className="pt-2 border-t border-space-600/50">
                  <button
                    onClick={undoLastAdjustment}
                    className="w-full btn-purple flex items-center justify-center gap-2"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span>撤回上一次调整</span>
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-gray-500 p-8"
            >
              <Info className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm text-center">点击时间轴上的指令块或左侧列表查看详情</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
