import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, FileText, Award, TrendingUp, 
  AlertTriangle, CheckCircle, XCircle,
  Clock, Target, Zap, RefreshCw,
  Play, Pause, SkipBack, SkipForward, Gauge
} from 'lucide-react';
import { useReplay, useReplayTimeline } from '../hooks/useReplay';
import { formatTime, formatDate } from '../utils/time';
import { exportMissionReport, exportMissionReportAsText, generateReportShareLink } from '../utils/export';
import type { MissionReport, ScoreBreakdown } from '../types/mission';

interface ReportPanelProps {
  report: MissionReport | null;
  onClose?: () => void;
}

export const ReportPanel: React.FC<ReportPanelProps> = ({ report, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'score' | 'timeline' | 'replay' | 'errors'>('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const replay = useReplay(report, { autoPlay: false, initialSpeed: 2 });
  const replayTimeline = useReplayTimeline(
    report?.timelineData || [],
    report?.startTime || 0,
    report?.endTime || 0,
    800
  );

  if (!report) {
    return (
      <div className="bg-deep-900 rounded-lg border border-deep-700 p-8 text-center">
        <FileText className="w-12 h-12 text-deep-600 mx-auto mb-4" />
        <p className="text-deep-400">暂无测控报告</p>
      </div>
    );
  }

  const { 
    finalScore, 
    grade, 
    scoreBreakdown, 
    statistics, 
    errorAnalysis,
    recommendations,
    timelineData,
  } = report;

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'S': 'text-yellow-400',
      'A': 'text-green-400',
      'B': 'text-blue-400',
      'C': 'text-yellow-500',
      'D': 'text-orange-500',
      'F': 'text-red-500',
    };
    return colors[grade] || 'text-white';
  };

  const getGradeBg = (grade: string) => {
    const colors: Record<string, string> = {
      'S': 'bg-yellow-500/20 border-yellow-500',
      'A': 'bg-green-500/20 border-green-500',
      'B': 'bg-blue-500/20 border-blue-500',
      'C': 'bg-yellow-600/20 border-yellow-600',
      'D': 'bg-orange-500/20 border-orange-500',
      'F': 'bg-red-500/20 border-red-500',
    };
    return colors[grade] || 'bg-deep-700 border-deep-600';
  };

  const getErrorColorClasses = (color: string) => {
    const colorMap: Record<string, { border: string; text: string; icon: string }> = {
      orange: {
        border: 'border-orange-700/50',
        text: 'text-orange-400',
        icon: 'text-orange-400',
      },
      yellow: {
        border: 'border-yellow-700/50',
        text: 'text-yellow-400',
        icon: 'text-yellow-400',
      },
      red: {
        border: 'border-red-700/50',
        text: 'text-red-400',
        icon: 'text-red-400',
      },
    };
    return colorMap[color] || colorMap.orange;
  };

  const handleExport = (format: 'json' | 'csv' | 'txt') => {
    if (!report) return;
    if (format === 'txt') {
      exportMissionReportAsText(report);
    } else {
      exportMissionReport(report);
    }
    setShowExportMenu(false);
  };

  const handleShare = () => {
    const link = generateReportShareLink(report);
    navigator.clipboard.writeText(link);
    alert('分享链接已复制到剪贴板');
    setShowExportMenu(false);
  };

  const renderScoreBar = (label: string, value: number, max: number, color: string) => {
    const percent = (value / max) * 100;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-deep-300">{label}</span>
          <span className="font-mono">{value} / {max}</span>
        </div>
        <div className="h-2 bg-deep-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-deep-900 rounded-lg border border-deep-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-deep-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gold-400" />
          <h3 className="text-sm font-semibold text-gold-400 font-mono">测控任务报告</h3>
          <span className="text-xs text-deep-400 font-mono">
            {formatDate(report.startTime)} - {formatDate(report.endTime)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-3 py-1.5 bg-deep-800 hover:bg-deep-700 rounded text-xs font-mono transition-colors"
            >
              <Download className="w-3 h-3" />
              导出报告
            </button>
            
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-1 bg-deep-800 border border-deep-600 rounded shadow-lg z-10 min-w-32"
                >
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-deep-700 transition-colors"
                  >
                    JSON 格式
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-deep-700 transition-colors"
                  >
                    CSV 格式
                  </button>
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-deep-700 transition-colors"
                  >
                    TXT 文本
                  </button>
                  <div className="border-t border-deep-600" />
                  <button
                    onClick={handleShare}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-deep-700 transition-colors text-gold-400"
                  >
                    生成分享链接
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-deep-700 rounded transition-colors"
            >
              <XCircle className="w-4 h-4 text-deep-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-deep-700">
        {[
          { key: 'overview', label: '总览', icon: Award },
          { key: 'score', label: '得分拆解', icon: TrendingUp },
          { key: 'errors', label: '错误分析', icon: AlertTriangle },
          { key: 'timeline', label: '时间线', icon: Clock },
          { key: 'replay', label: '回放', icon: RefreshCw },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-4 py-2 text-xs font-mono flex items-center justify-center gap-2 transition-colors ${
              activeTab === tab.key 
                ? 'bg-deep-800 text-gold-400 border-b-2 border-gold-500' 
                : 'text-deep-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 max-h-[600px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`inline-block px-8 py-6 rounded-lg border-2 ${getGradeBg(grade)}`}
                >
                  <div className={`text-6xl font-bold font-mono ${getGradeColor(grade)}`}>
                    {grade}
                  </div>
                  <div className="text-2xl font-mono text-white mt-2">
                    {finalScore.toFixed(0)} / 1000
                  </div>
                </motion.div>
                
                <p className="mt-4 text-sm text-deep-300">
                  {report.missionName} - 任务完成
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: '窗口利用率', value: `${statistics.windowUtilization.toFixed(1)}%`, icon: Target, color: 'text-blue-400' },
                  { label: '数据下载率', value: `${statistics.dataCompletionRate.toFixed(1)}%`, icon: Download, color: 'text-green-400' },
                  { label: '指令成功率', value: `${statistics.commandSuccessRate.toFixed(1)}%`, icon: CheckCircle, color: 'text-yellow-400' },
                  { label: '错误总数', value: statistics.totalErrors.toString(), icon: AlertTriangle, color: statistics.totalErrors > 0 ? 'text-red-400' : 'text-green-400' },
                ].map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-deep-800/50 rounded-lg p-4 text-center border border-deep-700"
                  >
                    <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                    <div className={`text-2xl font-mono font-bold ${stat.color}`}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-deep-400 mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {recommendations.length > 0 && (
                <div className="bg-deep-800/30 rounded-lg p-4 border border-gold-700/50">
                  <h4 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    改进建议
                  </h4>
                  <ul className="space-y-2">
                    {recommendations.map((rec, index) => (
                      <motion.li
                        key={index}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 text-xs"
                      >
                        <span className="text-gold-400 mt-0.5">•</span>
                        <span className="text-deep-200">{rec}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'score' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-deep-800/50 rounded-lg p-6 border border-deep-700">
                <h4 className="text-sm font-semibold text-gold-400 mb-4">得分详情</h4>
                <div className="space-y-4">
                  {renderScoreBar('数据下载', scoreBreakdown.dataDownload, 400, '#27ae60')}
                  {renderScoreBar('指令发送', scoreBreakdown.commandDelivery, 300, '#3498db')}
                  {renderScoreBar('资源利用', scoreBreakdown.resourceUtilization, 200, '#9b59b6')}
                  {renderScoreBar('效率加成', scoreBreakdown.efficiencyBonus, 100, '#f39c12')}
                  
                  {scoreBreakdown.errorPenalty > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-deep-300">错误惩罚</span>
                        <span className="font-mono text-red-400">-{scoreBreakdown.errorPenalty}</span>
                      </div>
                      <div className="h-2 bg-deep-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(scoreBreakdown.errorPenalty / 400) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="h-full rounded-full bg-red-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-deep-600 flex items-center justify-between">
                  <span className="text-sm text-deep-300">最终得分</span>
                  <span className={`text-3xl font-mono font-bold ${getGradeColor(grade)}`}>
                    {finalScore.toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {errorAnalysis.deductionDetails.map((detail, index) => (
                  <div key={index} className="bg-deep-800/50 rounded-lg p-3 border border-deep-700">
                    <div className="text-xs text-deep-400 mb-1">{detail.type}</div>
                    <div className="text-xl font-mono font-bold text-red-400">
                      -{detail.totalDeduction}
                    </div>
                    <div className="text-[10px] text-deep-500 mt-1">
                      {detail.count} 次
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'errors' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {errorAnalysis.totalErrors === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-green-400">完美！任务执行过程中没有发生任何错误</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      {
                        type: 'window_missed',
                        label: '窗口错过',
                        count: errorAnalysis.errorsByType.window_missed || 0,
                        color: 'orange',
                        icon: Clock,
                        reasons: errorAnalysis.deductionDetails.find(d => d.type.includes('窗口'))?.breakdown || []
                      },
                      {
                        type: 'command_timeout',
                        label: '指令超时',
                        count: errorAnalysis.errorsByType.command_timeout || 0,
                        color: 'yellow',
                        icon: Zap,
                        reasons: errorAnalysis.deductionDetails.find(d => d.type.includes('指令'))?.breakdown || []
                      },
                      {
                        type: 'data_packet_lost',
                        label: '数据包丢失',
                        count: errorAnalysis.errorsByType.data_packet_lost || 0,
                        color: 'red',
                        icon: Download,
                        reasons: errorAnalysis.deductionDetails.find(d => d.type.includes('数据'))?.breakdown || []
                      }
                    ].map(errorType => {
                      const colorClasses = getErrorColorClasses(errorType.color);
                      return (
                        <div 
                          key={errorType.type}
                          className={`bg-deep-800/50 rounded-lg p-4 border ${colorClasses.border}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <errorType.icon className={`w-5 h-5 ${colorClasses.icon}`} />
                              <span className={`text-sm font-semibold ${colorClasses.text}`}>
                                {errorType.label}
                              </span>
                            </div>
                            <span className={`text-2xl font-mono font-bold ${colorClasses.text}`}>
                              {errorType.count}
                            </span>
                          </div>
                          
                          {errorType.reasons.length > 0 && (
                            <div className="space-y-1">
                              {errorType.reasons.map((reason, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                  <span className="text-deep-400">{reason.reason}</span>
                                  <span className={`${colorClasses.text} font-mono`}>
                                    {reason.count}次
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-deep-800/30 rounded-lg p-4 border border-deep-700">
                    <h4 className="text-sm font-semibold text-gold-400 mb-3">错误事件列表</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {timelineData
                        .filter(e => e.severity === 'error' || e.severity === 'critical')
                        .map((event, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-deep-800/50 rounded">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-deep-400">
                                {formatTime(event.timestamp)}
                              </div>
                              <div className="text-xs text-deep-200 truncate">
                                {event.message}
                              </div>
                            </div>
                            {event.scoreImpact && (
                              <span className="text-xs font-mono text-red-400 flex-shrink-0">
                                {event.scoreImpact}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'timeline' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="relative h-16 bg-deep-800 rounded-lg overflow-hidden">
                {replayTimeline.getKeyEventMarkers().map((marker, index) => (
                  <div
                    key={index}
                    className="absolute top-0 bottom-0 w-1 cursor-pointer hover:w-2 transition-all"
                    style={{ 
                      left: `${marker.x}px`,
                      backgroundColor: replayTimeline.getTypeColor(marker.type)
                    }}
                    title={`${formatTime(marker.event.timestamp)}: ${marker.event.message}`}
                  />
                ))}
                
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-gold-400 z-10"
                  style={{ left: `${replayTimeline.timeToX(report.startTime)}px` }}
                />
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {timelineData.map((event, index) => (
                  <motion.div
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`flex items-start gap-3 p-2 rounded border-l-2 ${
                      event.severity === 'critical' || event.severity === 'error'
                        ? 'border-red-500 bg-red-900/10'
                        : event.severity === 'warning'
                        ? 'border-yellow-500 bg-yellow-900/10'
                        : 'border-blue-500 bg-blue-900/10'
                    }`}
                  >
                    <span className="text-xs font-mono text-deep-400 flex-shrink-0 w-16">
                      {formatTime(event.timestamp)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-deep-200">{event.message}</div>
                      {event.scoreImpact && event.scoreImpact !== 0 && (
                        <span className={`text-[10px] font-mono ${event.scoreImpact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {event.scoreImpact > 0 ? '+' : ''}{event.scoreImpact}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'replay' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="bg-deep-800/50 rounded-lg p-4 border border-deep-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={replay.reset}
                      disabled={replay.isAtStart}
                      className="p-2 bg-deep-700 hover:bg-deep-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={replay.stepBackward}
                      disabled={replay.isAtStart}
                      className="p-2 bg-deep-700 hover:bg-deep-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={replay.toggle}
                      className="p-3 bg-gold-600 hover:bg-gold-500 rounded transition-colors"
                    >
                      {replay.isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={replay.stepForward}
                      disabled={replay.isAtEnd}
                      className="p-2 bg-deep-700 hover:bg-deep-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                    <button
                      onClick={replay.stop}
                      className="p-2 bg-deep-700 hover:bg-deep-600 rounded transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-deep-400" />
                    <div className="flex bg-deep-700 rounded">
                      {[0.25, 0.5, 1, 2, 4, 8, 16].map(s => (
                        <button
                          key={s}
                          onClick={() => replay.changeSpeed(s)}
                          className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                            replay.speed === s 
                              ? 'bg-gold-600 text-white' 
                              : 'text-deep-400 hover:text-white'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative h-4 bg-deep-700 rounded-full overflow-hidden mb-4">
                  <motion.div
                    className="h-full bg-gold-500 rounded-full"
                    style={{ width: `${replay.getProgress() * 100}%` }}
                  />
                  
                  {replayTimeline.getKeyEventMarkers().map((marker, index) => (
                    <div
                      key={index}
                      className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                      style={{ left: `${marker.x / 8}%` }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-deep-400 font-mono">
                  <span>{formatTime(replay.currentTime)}</span>
                  <span>{replay.currentIndex} / {replay.totalEvents} 事件</span>
                  <span>{formatTime(report.endTime)}</span>
                </div>
              </div>

              <div className="bg-deep-800/30 rounded-lg p-4 border border-deep-700 max-h-60 overflow-y-auto">
                <h4 className="text-xs font-semibold text-deep-400 mb-3 font-mono">事件回放</h4>
                <div className="space-y-2">
                  {replay.replayedEvents.map((event, index) => (
                    <motion.div
                      key={index}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className={`p-2 rounded text-xs ${
                        event.severity === 'error' || event.severity === 'critical'
                          ? 'bg-red-900/20 border-l-2 border-red-500'
                          : event.severity === 'warning'
                          ? 'bg-yellow-900/20 border-l-2 border-yellow-500'
                          : 'bg-blue-900/20 border-l-2 border-blue-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-deep-400">{formatTime(event.timestamp)}</span>
                        {event.scoreImpact && event.scoreImpact !== 0 && (
                          <span className={`font-mono ${event.scoreImpact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {event.scoreImpact > 0 ? '+' : ''}{event.scoreImpact}
                          </span>
                        )}
                      </div>
                      <div className="text-deep-200 mt-1">{event.message}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
