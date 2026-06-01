import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, X, Clock, User, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { GameState, GameRecord } from '../types';
import { DATA_FLAG_LABELS, FAILURE_REASON_LABELS, DATA_SOURCE_LABELS } from '../types';
import { FLAG_COLORS } from '../config/gameConfig';

interface PlaybackPanelProps {
  state: GameState;
  onPrev: () => void;
  onNext: () => void;
  onGoto: (index: number) => void;
  onStop: () => void;
}

export const PlaybackPanel: React.FC<PlaybackPanelProps> = ({
  state,
  onPrev,
  onNext,
  onGoto,
  onStop,
}) => {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const autoPlayRef = useRef<number | null>(null);

  const currentRecord = state.playbackIndex >= 0 ? state.records[state.playbackIndex] : null;
  const totalRecords = state.records.length;
  const isAtStart = state.playbackIndex <= 0;
  const isAtEnd = state.playbackIndex >= totalRecords - 1;

  useEffect(() => {
    if (isAutoPlaying && !isAtEnd) {
      autoPlayRef.current = window.setTimeout(() => {
        onNext();
      }, speed);
    } else if (isAtEnd) {
      setIsAutoPlaying(false);
    }

    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, state.playbackIndex, speed, isAtEnd, onNext]);

  const toggleAutoPlay = () => {
    if (isAtEnd) {
      onGoto(0);
    }
    setIsAutoPlaying(!isAutoPlaying);
  };

  const getFlagBadge = (flag: string) => {
    const colorClass = FLAG_COLORS[flag] || 'bg-gray-500';
    return (
      <span
        key={flag}
        className={`px-2 py-0.5 text-xs font-bold rounded text-white ${colorClass}`}
      >
        {DATA_FLAG_LABELS[flag as keyof typeof DATA_FLAG_LABELS] || flag}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
          <Clock className="w-6 h-6" />
          回放模式
        </h2>
        <button
          onClick={onStop}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <X className="w-4 h-4" />
          退出回放
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((state.playbackIndex + 1) / totalRecords) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-500 font-mono">
            <span>第 {state.playbackIndex + 1} 条</span>
            <span>共 {totalRecords} 条</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onGoto(0)}
            disabled={isAtStart}
            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <SkipBack className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={onPrev}
            disabled={isAtStart}
            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <SkipBack className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={toggleAutoPlay}
            className={`p-4 rounded-lg transition-all hover:scale-105 active:scale-95 ${
              isAutoPlaying
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isAutoPlaying ? (
              <Pause className="w-6 h-6 text-white" fill="currentColor" />
            ) : (
              <Play className="w-6 h-6 text-white" fill="currentColor" />
            )}
          </button>
          <button
            onClick={onNext}
            disabled={isAtEnd}
            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <SkipForward className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onGoto(totalRecords - 1)}
            disabled={isAtEnd}
            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <SkipForward className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-gray-400">播放速度:</span>
          {[2000, 1000, 500, 200].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
                speed === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
            >
              {(1000 / s).toFixed(1)}x
            </button>
          ))}
        </div>
      </div>

      {currentRecord && (
        <motion.div
          key={currentRecord.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-6 rounded-lg border-2 ${
            currentRecord.isSuccess
              ? 'bg-emerald-900/20 border-emerald-700'
              : 'bg-red-900/20 border-red-700'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                currentRecord.isSuccess ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {currentRecord.sequence}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {currentRecord.isSuccess ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-2xl font-bold text-white font-mono">
                    {currentRecord.processedValue !== null ? currentRecord.processedValue : '空值'}
                    <span className="text-gray-500 text-lg ml-1">kg</span>
                  </span>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {currentRecord.formattedTime}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-amber-500 font-mono">
                载荷: {currentRecord.load}kg
              </div>
              <div className="text-sm text-gray-500">
                第 {currentRecord.roundNumber} 轮
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {currentRecord.flags.map(getFlagBadge)}
            {!currentRecord.isSuccess && currentRecord.failureReason && (
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-900/50 text-red-400 border border-red-700">
                {FAILURE_REASON_LABELS[currentRecord.failureReason]}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-400">
                <User className="w-4 h-4" />
                <span>处理人:</span>
                <span className="text-white">{currentRecord.operator}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <FileText className="w-4 h-4" />
                <span>来源:</span>
                <span className="text-white">{DATA_SOURCE_LABELS[currentRecord.source]}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span>原始值:</span>
                <span className="text-amber-400 font-mono">
                  {currentRecord.rawValue !== null && currentRecord.rawValue !== ''
                    ? String(currentRecord.rawValue)
                    : '<空值>'}
                </span>
              </div>
              {currentRecord.responseTime && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>响应时间:</span>
                  <span className="text-white font-mono">{currentRecord.responseTime}ms</span>
                </div>
              )}
            </div>
            <div>
              <div className="text-gray-400 mb-1">原始备注:</div>
              <div className="p-2 bg-slate-900/50 rounded border border-slate-700 text-white">
                {currentRecord.note || '<无备注>'}
              </div>
            </div>
          </div>

          {currentRecord.processingNote && (
            <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700/50 rounded">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                处理说明（给阿蓝交接用）
              </div>
              <p className="text-amber-200 text-sm">{currentRecord.processingNote}</p>
            </div>
          )}

          {!currentRecord.isSuccess && currentRecord.failureDetail && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
              <div className="text-red-400 text-xs font-bold mb-1">失败详情</div>
              <p className="text-red-200 text-sm">{currentRecord.failureDetail}</p>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {state.records.map((record: GameRecord, index: number) => (
          <button
            key={record.id}
            onClick={() => onGoto(index)}
            className={`flex-shrink-0 w-10 h-10 rounded-lg font-mono text-sm font-bold transition-all ${
              index === state.playbackIndex
                ? record.isSuccess
                  ? 'bg-emerald-600 text-white scale-110'
                  : 'bg-red-600 text-white scale-110'
                : record.isSuccess
                  ? 'bg-slate-700 text-white hover:bg-slate-600'
                  : 'bg-red-900/50 text-red-400 hover:bg-slate-600'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
