
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  MapPin
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { OperationRecord, MineCell } from '../types';
import { getMineralById } from '../data/minerals';

export const ReplayPage: React.FC = () => {
  const navigate = useNavigate();
  const originalState = useGameStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayState, setReplayState] = useState<{
    power: number;
    score: number;
    mineGrid: MineCell[][];
    selectedCell: string | null;
  }>(() => ({
    power: originalState.maxPower,
    score: 0,
    mineGrid: originalState.mineGrid.map(row =>
      row.map(cell => ({
        ...cell,
        status: 'unknown' as MineCell['status'],
        playerGuess: null,
        isCorrect: null,
        minedQuantity: 0
      }))
    ),
    selectedCell: null
  }));

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const history = originalState.operationHistory;

  useEffect(() => {
    if (isPlaying && currentStep < history.length) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= history.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, history.length]);

  useEffect(() => {
    if (history.length === 0) return;

    let power = originalState.maxPower;
    let score = 0;
    const gridState: MineCell[][] = originalState.mineGrid.map(row =>
      row.map(cell => ({
        ...cell,
        status: 'unknown' as MineCell['status'],
        playerGuess: null,
        isCorrect: null,
        minedQuantity: 0
      }))
    );

    for (let i = 0; i <= currentStep && i < history.length; i++) {
      const record = history[i];
      power -= record.powerCost;

      const cell = gridState[record.cellPosition.y][record.cellPosition.x];

      if (record.type === 'scan') {
        cell.status = 'scanned';
      } else if (record.type === 'guess') {
        cell.playerGuess = record.result.playerGuess || null;
        cell.isCorrect = record.result.isCorrect ?? null;
      } else if (record.type === 'mine') {
        cell.status = 'mined';
        cell.minedQuantity = record.result.quantity || 0;
        score += record.result.scoreChange || 0;
      }
    }

    setReplayState({
      power,
      score,
      mineGrid: gridState,
      selectedCell: currentStep < history.length ? history[currentStep].cellId : null
    });
  }, [currentStep, history, originalState]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setCurrentStep((prev) => Math.min(history.length - 1, prev + 1));
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const getCurrentRecord = (): OperationRecord | null => {
    if (history.length === 0 || currentStep >= history.length) return null;
    return history[currentStep];
  };

  const currentRecord = getCurrentRecord();

  const getCellStatusColor = (cell: MineCell) => {
    switch (cell.status) {
      case 'unknown':
        return 'bg-slate-700 border-slate-600';
      case 'scanned':
        if (cell.isCorrect === true) return 'bg-green-900/50 border-green-500';
        if (cell.isCorrect === false) return 'bg-red-900/50 border-red-500';
        return 'bg-cyan-900/30 border-cyan-500';
      case 'mined':
        return 'bg-amber-900/30 border-amber-600';
      default:
        return 'bg-slate-700 border-slate-600';
    }
  };

  if (history.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">暂无回放数据</h2>
          <p className="text-slate-400 mb-6">请先完成一局游戏</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
          >
            返回游戏
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/report')}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">操作回放</h1>
                <p className="text-xs text-slate-400">
                  共 {history.length} 步操作
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300">电量:</span>
                <span className="text-cyan-400 font-mono">{replayState.power}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-300">得分:</span>
                <span className="text-amber-400 font-mono font-bold">{replayState.score}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">矿区状态</h3>

            <div className="grid grid-cols-6 gap-2 mb-6">
              {replayState.mineGrid.map((row, y) =>
                row.map((cell) => (
                  <div
                    key={cell.id}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                      transition-all duration-300
                      ${getCellStatusColor(cell)}
                      ${replayState.selectedCell === cell.id ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}
                    `}
                  >
                    {cell.mineral && cell.status !== 'unknown' && (
                      <div
                        className="w-3 h-3 rounded-full mb-1"
                        style={{ backgroundColor: cell.mineral.color }}
                      />
                    )}
                    <span className="text-xs text-slate-400">
                      {cell.x + 1},{cell.y + 1}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-700 rounded border border-slate-600" />
                <span>未探测</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-cyan-900/50 rounded border border-cyan-500" />
                <span>已扫描</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-900/50 rounded border border-amber-600" />
                <span>已开采</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">当前操作</h3>

            {currentRecord ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
                  <div className={`px-3 py-1 rounded text-sm font-medium ${
                    currentRecord.type === 'scan' ? 'bg-cyan-900/50 text-cyan-400' :
                    currentRecord.type === 'guess' ? 'bg-purple-900/50 text-purple-400' :
                    'bg-amber-900/50 text-amber-400'
                  }`}>
                    {currentRecord.type === 'scan' ? '扫描' :
                     currentRecord.type === 'guess' ? '识别' : '开采'}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-4 h-4" />
                    <span>位置 ({currentRecord.cellPosition.x + 1}, {currentRecord.cellPosition.y + 1})</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">使用设备:</span>
                    <span className="text-slate-200">{currentRecord.equipment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">电量消耗:</span>
                    <span className="text-amber-400">-{currentRecord.powerCost}</span>
                  </div>

                  {currentRecord.type === 'guess' && (
                    <div className="mt-4 p-3 rounded-lg border">
                      <div className="text-slate-400 mb-2">识别结果:</div>
                      <div className={`font-medium ${
                        currentRecord.result.isCorrect ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {currentRecord.result.isCorrect ? '✓ 识别正确' : '✗ 识别错误'}
                      </div>
                      {currentRecord.result.playerGuess && (
                        <div className="text-slate-300 text-sm mt-1">
                          猜测: {getMineralById(currentRecord.result.playerGuess)?.nameCn || '未知'}
                        </div>
                      )}
                    </div>
                  )}

                  {currentRecord.type === 'mine' && (
                    <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-700/50">
                      <div className="text-slate-400 mb-2">开采结果:</div>
                      <div className="text-green-400 font-medium">
                        +{currentRecord.result.quantity} 单位矿石
                      </div>
                      <div className="text-cyan-400 text-sm mt-1">
                        +{currentRecord.result.scoreChange} 分
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                回放结束
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="重置"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={handleStepBack}
              disabled={currentStep === 0}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="上一步"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={handleStepForward}
              disabled={currentStep >= history.length - 1}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="下一步"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm font-mono w-16">
              {currentStep + 1}/{history.length}
            </span>
            <input
              type="range"
              min={0}
              max={history.length - 1}
              value={currentStep}
              onChange={(e) => {
                setCurrentStep(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <div className="mt-6 overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">步骤</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">类型</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">位置</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">电量</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">结果</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, index) => (
                  <tr
                    key={index}
                    className={`border-b border-slate-700/50 cursor-pointer transition-colors ${
                      index === currentStep
                        ? 'bg-cyan-900/30'
                        : 'hover:bg-slate-700/30'
                    }`}
                    onClick={() => {
                      setCurrentStep(index);
                      setIsPlaying(false);
                    }}
                  >
                    <td className="py-2 px-3 text-slate-300 font-mono">{index + 1}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        record.type === 'scan' ? 'bg-cyan-900/50 text-cyan-400' :
                        record.type === 'guess' ? 'bg-purple-900/50 text-purple-400' :
                        'bg-amber-900/50 text-amber-400'
                      }`}>
                        {record.type === 'scan' ? '扫描' :
                         record.type === 'guess' ? '识别' : '开采'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-mono">
                      ({record.cellPosition.x + 1}, {record.cellPosition.y + 1})
                    </td>
                    <td className="py-2 px-3 text-amber-400 font-mono">-{record.powerCost}</td>
                    <td className="py-2 px-3 text-slate-300 text-xs">
                      {record.type === 'guess' && (
                        <span className={record.result.isCorrect ? 'text-green-400' : 'text-red-400'}>
                          {record.result.isCorrect ? '正确' : '错误'}
                        </span>
                      )}
                      {record.type === 'mine' && (
                        <span className="text-cyan-400">+{record.result.scoreChange}分</span>
                      )}
                      {record.type === 'scan' && '已扫描'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
