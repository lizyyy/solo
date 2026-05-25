import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Home,
  RotateCcw,
  Gauge,
  Users,
  Droplets,
  Clock,
  Footprints,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useReplay } from '../hooks/useReplay';
import { Pipe } from '../components/Pipe';
import { Valve } from '../components/Valve';
import { Node } from '../components/Node';
import type { GameState, Level } from '../engine/types';
import { buildConnectivity } from '../engine/solver';
import { getLevelById } from '../data/levels';

export const Replay: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { getRecordById, loadRecords } = useGameStore();

  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightedValveId, setHighlightedValveId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(null);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const record = recordId ? getRecordById(recordId) : undefined;

  useEffect(() => {
    if (record) {
      const lvl = getLevelById(record.levelId);
      if (lvl) {
        setLevel(lvl);
      }
    }
  }, [record]);

  const initialState = record?.settlementResult.report.finalState || ({} as GameState);
  const operations = record?.operations || [];

  const {
    currentIndex,
    isPlaying,
    playbackSpeed,
    currentState,
    play,
    pause,
    reset,
    goToStep,
    nextStep,
    prevStep,
    setSpeed,
  } = useReplay({
      operations,
      initialState,
    });

  if (!record || !level) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-center">
          <p className="text-lg mb-4">没有找到回放记录</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const sourceNodes = currentState.nodes.filter((n) => n.type === 'source');
  const uf = buildConnectivity(currentState.nodes, currentState.pipes, currentState.valves);

  const getIsDisconnected = (pipe: { fromNode: string; toNode: string }) => {
    return sourceNodes.every(
      (source) =>
        !uf.connected(source.id, pipe.fromNode) ||
        !uf.connected(source.id, pipe.toNode)
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentOperation = operations[currentIndex - 1];

  const minX = Math.min(...currentState.nodes.map((n) => n.x)) - 50;
  const maxX = Math.max(...currentState.nodes.map((n) => n.x)) + 50;
  const minY = Math.min(...currentState.nodes.map((n) => n.y)) - 60;
  const maxY = Math.max(...currentState.nodes.map((n) => n.y)) + 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🎬 历史回放
            </h1>
            <p className="text-slate-400">
              {record.levelName} - {new Date(record.timestamp).toLocaleString('zh-CN')}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white transition-all"
          >
            <Home className="w-5 h-5" />
            <span>返回首页</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Droplets className="w-4 h-4" />
              已隔离漏点
            </div>
            <div className="text-2xl font-bold text-green-400">
              {currentState.isolatedLeaks}/{level.targetIsolatedLeaks}
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Users className="w-4 h-4" />
              受影响用户
            </div>
            <div className="text-2xl font-bold text-orange-400">
              {currentState.affectedUsers}
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Gauge className="w-4 h-4" />
              平均压力
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {currentState.averagePressure.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Footprints className="w-4 h-4" />
              当前步数
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {currentIndex}/{operations.length}
            </div>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 mb-6">
          <div className="h-80 bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
            <svg
              viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
              className="w-full h-full"
            >
              <defs>
                <pattern
                id="replay-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              </pattern>
              </defs>
              <rect
                x={minX}
                y={minY}
                width={maxX - minX}
                height={maxY - minY}
                fill="url(#replay-grid)"
              />

              <g>
                {currentState.pipes.map((pipe) => (
                  <Pipe
                    key={pipe.id}
                    pipe={pipe}
                    nodes={currentState.nodes}
                    isDisconnected={getIsDisconnected(pipe)}
                  />
                ))}
              </g>

              <g>
                {currentState.valves.map((valve) => (
                  <Valve
                    key={valve.id}
                    valve={valve}
                    onClick={() => {}}
                    isHighlighted={highlightedValveId === valve.id || 
                      (currentOperation && currentOperation.valveId === valve.id)}
                    disabled={true}
                    onMouseEnter={() => setHighlightedValveId(valve.id)}
                    onMouseLeave={() => setHighlightedValveId(null)}
                  />
                ))}
              </g>

              <g>
                {currentState.nodes.map((node) => (
                  <Node
                    key={node.id}
                    node={node}
                    leaks={currentState.leaks}
                    userAreas={currentState.userAreas}
                    isHighlighted={highlightedNodeId === node.id}
                    onMouseEnter={() => setHighlightedNodeId(node.id)}
                    onMouseLeave={() => setHighlightedNodeId(null)}
                  />
                ))}
              </g>
            </svg>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={reset}
              className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center text-white transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={prevStep}
              disabled={currentIndex === 0}
              className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            {isPlaying ? (
              <button
                onClick={pause}
                className="w-16 h-16 bg-yellow-600 hover:bg-yellow-500 rounded-2xl flex items-center justify-center text-white transition-all shadow-lg"
              >
                <Pause className="w-7 h-7" />
              </button>
            ) : (
              <button
                onClick={play}
                className="w-16 h-16 bg-green-600 hover:bg-green-500 rounded-2xl flex items-center justify-center text-white transition-all shadow-lg"
              >
                <Play className="w-7 h-7 ml-1" />
              </button>
            )}
            <button
              onClick={nextStep}
              disabled={currentIndex >= operations.length}
              className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-slate-700 rounded-xl overflow-hidden">
              {[0.5, 1, 1.5, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSpeed(speed)}
                  className={`px-3 py-2 text-sm font-medium transition-all ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-600'
                }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
              <span>第 {currentIndex} 步 / 共 {operations.length} 步</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTime(currentState.elapsedTime)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={operations.length}
              value={currentIndex}
              onChange={(e) => goToStep(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between">
              {operations.map((op, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index < currentIndex
                      ? 'bg-blue-500'
                      : index === currentIndex
                      ? 'bg-yellow-400 ring-2 ring-yellow-400/50'
                      : 'bg-slate-600'
                  }`}
                  title={`第 ${index + 1} 步: 阀门 ${op.valveId} ${op.toState ? '开启' : '关闭'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {currentOperation && (
          <div className="mt-6 bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">当前操作</h3>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    currentOperation.toState
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {currentOperation.toState ? '开' : '关'}
                </div>
                <div>
                  <div className="text-white font-medium">
                  阀门 {currentOperation.valveId}
                </div>
                  <div className="text-slate-400 text-sm">
                    {currentOperation.fromState ? '开启' : '关闭'} → {currentOperation.toState ? '开启' : '关闭'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">操作历史</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {operations.map((op, index) => (
              <div
                key={index}
                onClick={() => goToStep(index + 1)}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                index < currentIndex
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : index === currentIndex - 1
                  ? 'bg-yellow-500/20 border border-yellow-500/30'
                  : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
              }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm">
                    阀门 {op.valveId}{' '}
                    <span
                      className={op.toState ? 'text-green-400' : 'text-red-400'}>
                      {op.toState ? '开启' : '关闭'}
                    </span>
                  </div>
                  <div className="text-slate-500 text-xs">
                      {new Date(op.timestamp).toLocaleTimeString('zh-CN')}
                    </div>
                </div>
                {index < currentIndex && (
                  <div className="text-green-400 text-xs">已执行</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
