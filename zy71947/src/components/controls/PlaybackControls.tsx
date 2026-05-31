import React from 'react';
import { motion } from 'framer-motion';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useSequenceStore } from '../../store/useSequenceStore';
import { TimeService } from '../../services/timeService';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Undo2,
  FileText,
} from 'lucide-react';

const SPEEDS = [0.5, 1, 2, 4];

export const PlaybackControls: React.FC = () => {
  const {
    isPlaying,
    currentTime,
    playbackSpeed,
    startTime,
    endTime,
    togglePlaying,
    setPlaybackSpeed,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    openBriefing,
  } = usePlaybackStore();

  const { undoLastAdjustment, recalculator, anomalySummary } = useSequenceStore();

  const canUndo = recalculator?.canUndo() ?? false;
  const progress = ((currentTime - startTime) / (endTime - startTime)) * 100;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = startTime + percentage * (endTime - startTime);
    usePlaybackStore.getState().setCurrentTime(newTime);
  };

  return (
    <div className="h-16 bg-space-800 border-t border-space-600/50 px-4 flex items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 border border-space-600 rounded overflow-hidden">
          <button
            onClick={jumpToStart}
            className="p-2 hover:bg-space-700 transition-colors"
            title="跳转到开始"
          >
            <ChevronsLeft className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={stepBackward}
            className="p-2 hover:bg-space-700 transition-colors"
            title="后退60秒"
          >
            <SkipBack className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={togglePlaying}
            className="p-2 px-3 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-cyber-cyan" />
            ) : (
              <Play className="w-5 h-5 text-cyber-cyan" />
            )}
          </button>
          <button
            onClick={stepForward}
            className="p-2 hover:bg-space-700 transition-colors"
            title="前进60秒"
          >
            <SkipForward className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={jumpToEnd}
            className="p-2 hover:bg-space-700 transition-colors"
            title="跳转到结束"
          >
            <ChevronsRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {SPEEDS.map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                playbackSpeed === speed
                  ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-space-700'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-2 bg-space-700 rounded-full cursor-pointer relative overflow-hidden group"
          onClick={handleProgressClick}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-cyber-cyan/60 to-cyber-cyan rounded-full"
            style={{ width: `${progress}%` }}
            initial={false}
            transition={{ duration: 0.1 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-cyber-cyan rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-gray-500">
          <span>{TimeService.formatRelative(currentTime)}</span>
          <span>{TimeService.formatRelative(endTime)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />
            <span className="text-gray-400">窗口重叠 {anomalySummary.windowOverlap}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-yellow" />
            <span className="text-gray-400">遥测缺帧 {anomalySummary.telemetryMissing}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-purple" />
            <span className="text-gray-400">人工调整 {anomalySummary.manualInsert}</span>
          </div>
        </div>

        <div className="w-px h-8 bg-space-600 mx-2" />

        <button
          onClick={undoLastAdjustment}
          disabled={!canUndo}
          className={`btn-purple flex items-center gap-2 text-sm ${
            !canUndo ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="撤回上一次人工调整"
        >
          <Undo2 className="w-4 h-4" />
          <span>撤回调整</span>
        </button>

        <button
          onClick={openBriefing}
          className="btn-primary flex items-center gap-2 text-sm"
          title="导出任务简报"
        >
          <FileText className="w-4 h-4" />
          <span>任务简报</span>
        </button>
      </div>
    </div>
  );
};
