import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGameStore } from '../game/state';
import { getLevelById } from '../data/levels';

export const ReplayPlayer: React.FC = () => {
  const {
    replayData,
    replayStepIndex,
    replayNextStep,
    replayPrevStep,
    replayGoToStep,
    goToMenu,
  } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAutoPlaying, setIsAutoPlaying] = React.useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isAutoPlaying && replayData && replayStepIndex < replayData.steps.length - 1) {
      autoPlayRef.current = setTimeout(() => {
        replayNextStep();
      }, 1000);
    } else if (replayStepIndex >= (replayData?.steps.length || 0) - 1) {
      setIsAutoPlaying(false);
    }

    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, replayStepIndex, replayData, replayNextStep]);

  const currentStep = replayData?.steps[replayStepIndex];
  const level = replayData ? getLevelById(replayData.levelId) : null;

  const getVisitedNodesUpToStep = (): string[] => {
    if (!replayData) return [];
    const visited: string[] = [];
    for (let i = 0; i <= replayStepIndex; i++) {
      const step = replayData.steps[i];
      if (step.nodeId && !visited.includes(step.nodeId)) {
        visited.push(step.nodeId);
      }
    }
    return visited;
  };

  const getCurrentPosition = (): string => {
    if (!replayData || !level) return level?.startNode || '';
    for (let i = replayStepIndex; i >= 0; i--) {
      const step = replayData.steps[i];
      if (step.nodeId) {
        return step.nodeId;
      }
    }
    return level.startNode;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !level) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 900;
    const height = 450;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f0fdf4');
    gradient.addColorStop(1, '#dcfce7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    const currentNodeId = getCurrentPosition();
    const visitedNodes = getVisitedNodesUpToStep();
    const currentNodeData = level.nodes.find(n => n.id === currentNodeId);
    const connectedNodes = currentNodeData?.connections || [];

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    level.nodes.forEach(node => {
      node.connections.forEach(connId => {
        const connNode = level.nodes.find(n => n.id === connId);
        if (!connNode) return;

        const isVisitedPath = visitedNodes.includes(node.id) && visitedNodes.includes(connId);
        const isCurrentPath = node.id === currentNodeId || connId === currentNodeId;

        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(connNode.x, connNode.y);

        if (isVisitedPath && isCurrentPath) {
          ctx.strokeStyle = '#4ade80';
        } else if (isVisitedPath) {
          ctx.strokeStyle = '#86efac';
        } else {
          ctx.strokeStyle = '#d1d5db';
        }
        ctx.stroke();
      });
    });

    const getNodeColor = (node: any, isCurrent: boolean, isVisited: boolean): string => {
      if (isCurrent) return '#4ade80';
      if (node.type === 'start') return '#22c55e';
      if (node.type === 'end') return '#eab308';
      if (node.type === 'supply') return '#3b82f6';
      if (isVisited) return '#6b7280';
      return '#9ca3af';
    };

    const getNodeIcon = (node: any): string => {
      switch (node.type) {
        case 'start': return '🏁';
        case 'end': return '🎯';
        case 'supply': return '🏪';
        default: return '📍';
      }
    };

    level.nodes.forEach(node => {
      const isCurrent = node.id === currentNodeId;
      const isVisited = visitedNodes.includes(node.id);
      const radius = isCurrent ? 28 : 22;

      if (isCurrent) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node, isCurrent, isVisited);
      ctx.fill();
      ctx.strokeStyle = isCurrent ? '#166534' : '#4b5563';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(getNodeIcon(node), node.x, node.y);

      ctx.font = 'bold 11px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.x, node.y + radius + 14);
    });

    if (currentNodeData) {
      ctx.font = 'bold 14px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#166534';
      ctx.textAlign = 'left';
      ctx.fillText(`📍 当前位置: ${currentNodeData.name}`, 15, 25);
    }
  }, [level, replayStepIndex, replayData]);

  const toggleAutoPlay = () => {
    if (replayStepIndex >= (replayData?.steps.length || 0) - 1) {
      replayGoToStep(0);
    }
    setIsAutoPlaying(!isAutoPlaying);
  };

  if (!replayData || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="game-card p-8 text-center">
          <p className="text-gray-500">没有回放数据</p>
          <button onClick={goToMenu} className="game-btn-primary mt-4">
            返回菜单
          </button>
        </div>
      </div>
    );
  }

  const getActionText = (action: string): string => {
    switch (action) {
      case 'move': return '🚶 移动';
      case 'supply': return '🏪 补给';
      case 'event': return '⚡ 事件';
      case 'inventory': return '🎒 整理';
      default: return action;
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-700">
              🎬 回放: {level.name}
            </h1>
            <p className="text-sm text-gray-500">
              {replayData.isWin ? '✅ 胜利' : '❌ 失败'} - 最终得分: {replayData.finalScore.total}
            </p>
          </div>
          <button onClick={goToMenu} className="game-btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" />
            返回菜单
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="game-card p-4 mb-4">
              <canvas
                ref={canvasRef}
                width={900}
                height={450}
                className="w-full rounded-lg border-2 border-primary-200"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>

            <div className="game-card p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600">
                  步骤 {replayStepIndex + 1} / {replayData.steps.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => replayGoToStep(0)}
                    className="game-btn-secondary p-2"
                    disabled={replayStepIndex === 0}
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={replayPrevStep}
                    className="game-btn-secondary p-2"
                    disabled={replayStepIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleAutoPlay}
                    className="game-btn-primary p-2"
                  >
                    {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={replayNextStep}
                    className="game-btn-secondary p-2"
                    disabled={replayStepIndex >= replayData.steps.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => replayGoToStep(replayData.steps.length - 1)}
                    className="game-btn-secondary p-2"
                    disabled={replayStepIndex >= replayData.steps.length - 1}
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const step = Math.floor(percent * (replayData.steps.length - 1));
                  replayGoToStep(step);
                }}
              >
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${((replayStepIndex + 1) / replayData.steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="game-card p-4">
              <h3 className="font-bold text-gray-800 mb-3">📊 当前状态</h3>
              {currentStep && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">回合</span>
                    <span className="font-medium">{currentStep.turn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">生命值</span>
                    <span className="font-medium text-red-500">
                      {currentStep.teamState.health}/{currentStep.teamState.maxHealth}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">行动点</span>
                    <span className="font-medium text-yellow-500">
                      {currentStep.teamState.actionPoints}/{currentStep.teamState.maxActionPoints}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">得分</span>
                    <span className="font-medium text-amber-500">{currentStep.scoreSnapshot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">操作</span>
                    <span className="font-medium">{getActionText(currentStep.action)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="game-card p-4">
              <h3 className="font-bold text-gray-800 mb-3">🎒 急救包</h3>
              {currentStep?.inventorySnapshot.length === 0 ? (
                <p className="text-sm text-gray-500">空</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentStep?.inventorySnapshot.map((item, idx) => (
                    <div key={idx} className={`p-2 rounded text-xs ${
                      item.isExpired ? 'bg-gray-100 opacity-60' :
                      item.type === 'medicine' ? 'bg-rose-50' :
                      item.type === 'bandage' ? 'bg-sky-50' : 'bg-amber-50'
                    }`}>
                      <div className="flex justify-between">
                        <span className="font-medium">{item.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                      {item.isExpired && <span className="text-red-500">(过期)</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="game-card p-4">
              <h3 className="font-bold text-gray-800 mb-3">📜 步骤列表</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {replayData.steps.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => replayGoToStep(idx)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      idx === replayStepIndex
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span className="mr-2">#{idx + 1}</span>
                    {getActionText(step.action)}
                    {step.nodeId && (
                      <span className="ml-2 text-gray-400">
                        @ {level.nodes.find(n => n.id === step.nodeId)?.name || step.nodeId}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
