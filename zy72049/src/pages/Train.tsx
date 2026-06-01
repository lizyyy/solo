import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrainingStore } from '../store/trainingStore';
import { getRecordById } from '../data/mockRecords';
import { Obstacle } from '../types';
import { getRiskLabel, getResourceColor, formatTime } from '../utils/businessEngine';
import {
  Zap, Cpu, Timer, Trophy, AlertTriangle, Pause, Play,
  RotateCcw, ArrowLeft, Flag, GripVertical, MousePointer2,
} from 'lucide-react';

const Train = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [draggedObstacle, setDraggedObstacle] = useState<string | null>(null);

  const {
    resources,
    obstacles,
    decisionHistory,
    isPaused,
    startTraining,
    handleObstacleDrag,
    handleObstacleClick,
    togglePause,
    completeTraining,
    resetTraining,
  } = useTrainingStore();

  useEffect(() => {
    if (recordId) {
      const success = startTraining(recordId);
      if (!success) {
        navigate('/');
      }
    }
  }, [recordId, navigate, startTraining]);

  const record = recordId ? getRecordById(recordId) : undefined;

  const handleDragStart = (obstacleId: string) => {
    if (isPaused) return;
    setDraggedObstacle(obstacleId);
  };

  const handleDragEnd = (obstacle: Obstacle) => {
    if (isPaused || obstacle.handled) return;
    handleObstacleDrag(obstacle);
    setDraggedObstacle(null);
  };

  const handleClick = (obstacle: Obstacle) => {
    if (isPaused || obstacle.handled) return;
    handleObstacleClick(obstacle);
  };

  const handleComplete = () => {
    completeTraining();
    if (recordId) {
      navigate(`/report/${recordId}`);
    }
  };

  if (!record) return null;

  const unhandledCount = obstacles.filter((o) => !o.handled).length;

  const riskBadgeClass = (() => {
    switch (resources.riskLevel) {
      case 0: return 'bg-green-500/20 text-green-400';
      case 1: return 'bg-yellow-500/20 text-yellow-400';
      case 2: return 'bg-orange-500/20 text-orange-400';
      case 3: return 'bg-red-500/20 text-red-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  })();

  const actionBadgeClass = (type: string) => {
    switch (type) {
      case 'drag': return 'bg-blue-500/20 text-blue-400';
      case 'click': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  const actionLabel = (type: string) => {
    switch (type) {
      case 'drag': return '拖拽';
      case 'click': return '点击';
      case 'pause': return '暂停';
      case 'resume': return '继续';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">{record.title}</h1>
              <p className="text-xs text-zinc-400">
                剩余障碍物: {unhandledCount} / {obstacles.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition-colors"
            >
              {isPaused ? (
                <><Play className="w-4 h-4 text-green-400" />继续</>
              ) : (
                <><Pause className="w-4 h-4 text-yellow-400" />暂停</>
              )}
            </button>
            <button
              onClick={resetTraining}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />重置
            </button>
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors"
            >
              <Flag className="w-4 h-4" />完成训练
            </button>
          </div>
        </div>
      </header>

      {isPaused && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            训练已暂停 - 操作已被禁用
          </div>
        </div>
      )}

      {resources.isNegative && resources.negativeWarning && (
        <div className="bg-red-500/10 border-b border-red-500/30">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {resources.negativeWarning}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">资源状态</h3>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm">能源</span>
                  </div>
                  <span className={`font-mono text-sm ${resources.energy < 0 ? 'text-red-400' : ''}`}>
                    {resources.energy}
                  </span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getResourceColor(resources.energy, record.initialResources.energy)} transition-all duration-300`}
                    style={{ width: `${Math.max(0, Math.min(100, (resources.energy / record.initialResources.energy) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">算力</span>
                  </div>
                  <span className={`font-mono text-sm ${resources.compute < 0 ? 'text-red-400' : ''}`}>
                    {resources.compute}
                  </span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getResourceColor(resources.compute, record.initialResources.compute)} transition-all duration-300`}
                    style={{ width: `${Math.max(0, Math.min(100, (resources.compute / record.initialResources.compute) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-green-400" />
                    <span className="text-sm">时间</span>
                  </div>
                  <span className={`font-mono text-sm ${resources.time < 0 ? 'text-red-400' : ''}`}>
                    {resources.time}
                  </span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getResourceColor(resources.time, record.initialResources.time)} transition-all duration-300`}
                    style={{ width: `${Math.max(0, Math.min(100, (resources.time / record.initialResources.time) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">当前分数</span>
                  </div>
                  <span className="font-mono text-2xl font-bold text-amber-400">
                    {resources.score}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">风险等级</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${riskBadgeClass}`}>
                    {getRiskLabel(resources.riskLevel)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">操作说明</h3>
              <div className="space-y-2 text-xs text-zinc-400">
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>拖拽障碍物 - 消耗更多能源和时间，获得满分</span>
                </div>
                <div className="flex items-start gap-2">
                  <MousePointer2 className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>点击障碍物 - 消耗更多算力，获得80%分数</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-6">
            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-400">避障训练场</h3>
              </div>
              <div className="relative h-96 bg-zinc-900 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'linear-gradient(#3f3f46 1px, transparent 1px), linear-gradient(90deg, #3f3f46 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />
                <div className="absolute left-0 right-0 top-1/2 h-16 -translate-y-1/2 bg-zinc-700/30" />
                <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-zinc-500/50" />

                {obstacles.map((obstacle) => (
                  <div
                    key={obstacle.id}
                    draggable={!obstacle.handled && !isPaused}
                    onDragStart={() => handleDragStart(obstacle.id)}
                    onDragEnd={() => handleDragEnd(obstacle)}
                    onClick={() => handleClick(obstacle)}
                    className={`absolute cursor-pointer transition-all duration-200 ${
                      obstacle.handled ? 'opacity-30 scale-90' : 'hover:scale-110 hover:shadow-lg'
                    } ${draggedObstacle === obstacle.id ? 'opacity-50 scale-95' : ''} ${
                      obstacle.type === 'static' ? 'bg-blue-600' : obstacle.type === 'moving' ? 'bg-orange-500' : 'bg-purple-500'
                    }`}
                    style={{
                      left: obstacle.x,
                      top: obstacle.y,
                      width: 60,
                      height: 60,
                      borderRadius: 8,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                      {obstacle.handled ? '✓' : obstacle.type === 'static' ? '■' : obstacle.type === 'moving' ? '●' : '?'}
                    </div>
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400 whitespace-nowrap">
                      {obstacle.id}
                    </div>
                  </div>
                ))}

                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-8 bg-green-500 rounded flex items-center justify-center text-xs font-bold">
                  🚗
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded" />
                <span>静态障碍</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full" />
                <span>移动障碍</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded" />
                <span>未知障碍</span>
              </div>
            </div>
          </div>

          <div className="col-span-3">
            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 h-full flex flex-col">
              <div className="px-4 py-3 border-b border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-400">操作日志</h3>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[420px] p-4 space-y-2">
                {decisionHistory.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-8">暂无操作记录</p>
                ) : (
                  decisionHistory.map((step) => (
                    <div key={step.id} className="p-3 bg-zinc-900/50 rounded-md text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-zinc-500">{formatTime(step.timestamp)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${actionBadgeClass(step.actionType)}`}>
                          {actionLabel(step.actionType)}
                        </span>
                      </div>
                      <p className="text-zinc-300">{step.description}</p>
                      {step.scoreDelta !== 0 && (
                        <div className="mt-1 text-zinc-500">
                          分数: {step.scoreDelta > 0 ? '+' : ''}{step.scoreDelta}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Train;
