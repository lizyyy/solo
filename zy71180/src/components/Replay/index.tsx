import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  X,
  Download,
  Clock,
  MapPin,
  Star,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import {
  GameHistory,
  Restaurant,
  Station,
  Truck,
  Position,
  RouteNode,
} from '@/types/game';
import { useReplay } from '@/hooks/useReplay';
import { getLevelById } from '@/data/levels';

interface ReplayProps {
  history: GameHistory;
  currentTurnIndex: number;
  onTurnChange: (index: number) => void;
  onExit: () => void;
  onExport: () => void;
}

const PADDING = 40;
const NODE_RADIUS = 24;
const TRUCK_RADIUS = 18;

const getCapacityColor = (percentage: number): string => {
  if (percentage < 60) return '#22c55e';
  if (percentage < 90) return '#f59e0b';
  return '#ef4444';
};

const getPulsePhase = (time: number, id: string): number => {
  const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (time / 500 + seed * 0.1) % (Math.PI * 2);
};

const calculateDistance = (a: Position, b: Position): number => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
};

const Replay: React.FC<ReplayProps> = ({
  history,
  currentTurnIndex,
  onTurnChange,
  onExit,
  onExport,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredInfo, setHoveredInfo] = useState<{
    node: RouteNode;
    screenX: number;
    screenY: number;
    data: Restaurant | Station | null;
  } | null>(null);

  const level = useMemo(() => getLevelById(history.levelId), [history.levelId]);

  const {
    isPlaying,
    speed,
    togglePlay,
    nextTurn,
    prevTurn,
    goToTurn,
    setSpeed,
  } = useReplay({
    totalTurns: history.turns.length,
    currentTurnIndex,
    onTurnChange,
  });

  const currentTurn = history.turns[currentTurnIndex];

  const restaurants = useMemo((): Restaurant[] => {
    if (!currentTurn) return history.initialRestaurants;

    return history.initialRestaurants.map((r) => {
      const state = currentTurn.restaurantStates.find((s) => s.id === r.id);
      return {
        ...r,
        currentOil: state?.currentOil ?? r.currentOil,
      };
    });
  }, [history.initialRestaurants, currentTurn]);

  const station: Station | null = useMemo(() => {
    return level?.station || null;
  }, [level]);

  const truck: Truck | null = useMemo(() => {
    if (!level || !currentTurn || currentTurn.route.length === 0) return null;

    const lastNode = currentTurn.route[currentTurn.route.length - 1];
    const truckBase = level.truck;

    let currentLoad = 0;
    for (const node of currentTurn.route) {
      if (node.type === 'restaurant') {
        const collected = currentTurn.collectedOil[node.id] || 0;
        currentLoad += collected;
      } else if (node.type === 'station') {
        currentLoad = 0;
      }
    }

    return {
      ...truckBase,
      position: lastNode.position,
      currentLoad,
    };
  }, [level, currentTurn]);

  const plannedRoute: RouteNode[] = useMemo(() => {
    return currentTurn?.route || [];
  }, [currentTurn]);

  const gridSize = useMemo(() => {
    return level?.gridSize || { width: 10, height: 8 };
  }, [level]);

  const cellSize = useMemo(() => {
    const availableWidth = dimensions.width - PADDING * 2;
    const availableHeight = dimensions.height - PADDING * 2;
    return {
      x: availableWidth / (gridSize.width - 1),
      y: availableHeight / (gridSize.height - 1),
    };
  }, [dimensions, gridSize]);

  const gridToScreen = useCallback(
    (pos: Position): Position => {
      return {
        x: PADDING + pos.x * cellSize.x,
        y: PADDING + pos.y * cellSize.y,
      };
    },
    [cellSize]
  );

  const screenToGrid = useCallback(
    (screenX: number, screenY: number): Position => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = (screenX - rect.left - PADDING) / cellSize.x;
      const y = (screenY - rect.top - PADDING) / cellSize.y;
      return { x: Math.round(x), y: Math.round(y) };
    },
    [cellSize]
  );

  const findNodeAtPosition = useCallback(
    (screenX: number, screenY: number): RouteNode | null => {
      const gridPos = screenToGrid(screenX, screenY);
      const threshold = 1.5;

      for (const restaurant of restaurants) {
        const dist = calculateDistance(gridPos, restaurant.position);
        if (dist < threshold) {
          return {
            type: 'restaurant',
            id: restaurant.id,
            position: restaurant.position,
          };
        }
      }

      if (station) {
        const dist = calculateDistance(gridPos, station.position);
        if (dist < threshold) {
          return {
            type: 'station',
            id: station.id,
            position: station.position,
          };
        }
      }

      return null;
    },
    [restaurants, station, screenToGrid]
  );

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    let time = 0;

    const draw = () => {
      time += 16;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      for (let x = 0; x < gridSize.width; x++) {
        const screenPos = gridToScreen({ x, y: 0 });
        ctx.beginPath();
        ctx.moveTo(screenPos.x, PADDING);
        ctx.lineTo(screenPos.x, dimensions.height - PADDING);
        ctx.stroke();
      }

      for (let y = 0; y < gridSize.height; y++) {
        const screenPos = gridToScreen({ x: 0, y });
        ctx.beginPath();
        ctx.moveTo(PADDING, screenPos.y);
        ctx.lineTo(dimensions.width - PADDING, screenPos.y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 3;

      for (let x = 0; x < gridSize.width; x++) {
        for (let y = 0; y < gridSize.height; y++) {
          const center = gridToScreen({ x, y });
          const hasRight = x < gridSize.width - 1;
          const hasBottom = y < gridSize.height - 1;

          if (hasRight) {
            const right = gridToScreen({ x: x + 1, y });
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(right.x, right.y);
            ctx.stroke();
          }

          if (hasBottom) {
            const bottom = gridToScreen({ x, y: y + 1 });
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(bottom.x, bottom.y);
            ctx.stroke();
          }
        }
      }

      if (plannedRoute.length > 1) {
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const firstPos = gridToScreen(plannedRoute[0].position);
        ctx.moveTo(firstPos.x, firstPos.y);

        for (let i = 1; i < plannedRoute.length; i++) {
          const pos = gridToScreen(plannedRoute[i].position);
          ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        plannedRoute.forEach((node, index) => {
          const pos = gridToScreen(node.position);
          const offsetX = index % 2 === 0 ? 20 : -20;
          const offsetY = index % 2 === 0 ? -20 : 20;

          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(pos.x + offsetX, pos.y + offsetY, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'white';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((index + 1).toString(), pos.x + offsetX, pos.y + offsetY);
        });
      }

      restaurants.forEach((restaurant) => {
        const pos = gridToScreen(restaurant.position);
        const percentage = (restaurant.currentOil / restaurant.barrelCapacity) * 100;
        const color = getCapacityColor(percentage);
        const isPulsing = percentage > 80;

        let radius = NODE_RADIUS;
        if (isPulsing) {
          const phase = getPulsePhase(time, restaurant.id);
          const pulseScale = 1 + Math.sin(phase) * 0.15;
          radius = NODE_RADIUS * pulseScale;

          const pulseRadius = radius + 8 + Math.sin(phase + Math.PI / 2) * 4;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, pulseRadius, 0, Math.PI * 2);
          ctx.fillStyle = `${color}33`;
          ctx.fill();
        }

        const isInRoute = plannedRoute.some((n) => n.id === restaurant.id);

        if (isInRoute) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const barWidth = radius * 1.5;
        const barHeight = 4;
        const barX = pos.x - barWidth / 2;
        const barY = pos.y + radius + 6;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barWidth * (percentage / 100), barHeight);

        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍽️', pos.x, pos.y);
      });

      if (station) {
        const pos = gridToScreen(station.position);
        const isInRoute = plannedRoute.some((n) => n.id === station.id);

        if (isInRoute) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, NODE_RADIUS + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#8b5cf6';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♻️', pos.x, pos.y);
      }

      if (truck) {
        const pos = gridToScreen(truck.position);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TRUCK_RADIUS + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TRUCK_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TRUCK_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚛', pos.x, pos.y);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    dimensions,
    gridSize,
    restaurants,
    station,
    truck,
    plannedRoute,
    gridToScreen,
  ]);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const node = findNodeAtPosition(e.clientX, e.clientY);

      if (node) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const data =
            node.type === 'restaurant'
              ? restaurants.find((r) => r.id === node.id) || null
              : station;
          setHoveredInfo({
            node,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
            data,
          });
        }
      } else {
        setHoveredInfo(null);
      }
    },
    [findNodeAtPosition, restaurants, station]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredInfo(null);
  }, []);

  const collectedRestaurants = useMemo(() => {
    if (!currentTurn) return [];
    return Object.entries(currentTurn.collectedOil)
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => {
        const restaurant = history.initialRestaurants.find((r) => r.id === id);
        return { id, name: restaurant?.name || id, amount };
      });
  }, [currentTurn, history.initialRestaurants]);

  const cumulativeScore = useMemo(() => {
    return history.turns
      .slice(0, currentTurnIndex + 1)
      .reduce((sum, turn) => sum + turn.scoreThisTurn, 0);
  }, [history.turns, currentTurnIndex]);

  const speedOptions = [0.5, 1, 2];

  const getTooltipPosition = () => {
    if (!hoveredInfo) return { x: 0, y: 0 };
    let x = hoveredInfo.screenX + 15;
    let y = hoveredInfo.screenY + 15;

    if (x + 200 > dimensions.width) {
      x = hoveredInfo.screenX - 215;
    }
    if (y + 150 > dimensions.height) {
      y = hoveredInfo.screenY - 165;
    }

    return { x, y };
  };

  const tooltipPos = getTooltipPosition();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">历史回放</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">{history.levelName}</span>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              history.isWin ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}
          >
            {history.isWin ? (
              <Trophy className="w-4 h-4 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span
              className={`text-sm font-medium ${
                history.isWin ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {history.isWin ? '胜利' : '失败'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>导出报告</span>
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            <span>退出回放</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 gap-6">
          <div
            ref={containerRef}
            className="flex-1 bg-slate-800/50 rounded-xl border border-white/10 relative overflow-hidden"
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              style={{ width: dimensions.width, height: dimensions.height }}
            />

            <AnimatePresence>
              {hoveredInfo && hoveredInfo.data && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bg-slate-900/95 backdrop-blur-sm rounded-lg p-3 border border-white/10 shadow-xl pointer-events-none z-10 min-w-[200px]"
                  style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>{hoveredInfo.node.type === 'restaurant' ? '🍽️' : '♻️'}</span>
                    <span className="font-semibold text-white">
                      {hoveredInfo.data.name}
                    </span>
                  </div>
                  {hoveredInfo.node.type === 'restaurant' && (
                    <>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">当前油量</span>
                        <span className="text-white">
                          {(hoveredInfo.data as Restaurant).currentOil} /{' '}
                          {(hoveredInfo.data as Restaurant).barrelCapacity} L
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${Math.round(
                              ((hoveredInfo.data as Restaurant).currentOil /
                                (hoveredInfo.data as Restaurant).barrelCapacity) *
                                100
                            )}%`,
                            backgroundColor: getCapacityColor(
                              ((hoveredInfo.data as Restaurant).currentOil /
                                (hoveredInfo.data as Restaurant).barrelCapacity) *
                                100
                            ),
                          }}
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
              <div className="text-sm text-slate-400">关卡</div>
              <div className="text-lg font-semibold text-white">{history.levelName}</div>
            </div>

            <div className="absolute top-4 right-4 bg-slate-900/85 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
              <div className="text-sm text-slate-400">最终得分</div>
              <div className="text-lg font-semibold text-white">{history.finalScore}</div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-slate-400">回放进度</div>
              <div className="text-sm text-slate-300">
                回合 {currentTurnIndex + 1} / {history.turns.length}
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={history.turns.length - 1}
              value={currentTurnIndex}
              onChange={(e) => goToTurn(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-4"
            />

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={prevTurn}
                disabled={currentTurnIndex === 0}
                className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlay}
                className={`p-4 ${
                  isPlaying
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white rounded-xl transition-colors shadow-lg`}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={nextTurn}
                disabled={currentTurnIndex >= history.turns.length - 1}
                className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 ml-4">
                <Gauge className="w-5 h-5 text-slate-400" />
                {speedOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      speed === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
            <div className="text-sm text-slate-400 mb-3">时间轴</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.turns.map((turn, index) => (
                <button
                  key={index}
                  onClick={() => goToTurn(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center transition-all ${
                    currentTurnIndex === index
                      ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <span className="text-xs opacity-70">回合</span>
                  <span className="text-lg font-bold">{index + 1}</span>
                  <span className="text-xs opacity-70">+{turn.scoreThisTurn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-white/10 p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              当前回合信息
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">回合数</span>
                <span className="text-white font-semibold">
                  {currentTurn?.turn || 1}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">本回合得分</span>
                <span className="text-green-400 font-semibold">
                  +{currentTurn?.scoreThisTurn || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">累计得分</span>
                <span className="text-white font-semibold">{cumulativeScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">行驶距离</span>
                <span className="text-white">
                  {currentTurn?.totalDistance.toFixed(1) || 0}
                </span>
              </div>
              {currentTurn?.complaints > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">投诉</span>
                  <span className="text-red-400 font-semibold">
                    +{currentTurn.complaints}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              收集的餐馆
            </h3>

            {collectedRestaurants.length > 0 ? (
              <div className="space-y-2">
                {collectedRestaurants.map(({ id, name, amount }) => (
                  <div
                    key={id}
                    className="flex justify-between items-center p-2 bg-slate-700/50 rounded-lg"
                  >
                    <span className="text-slate-300">🍽️ {name}</span>
                    <span className="text-green-400 font-medium">+{amount}L</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4">
                本回合未收集任何餐馆
              </div>
            )}
          </div>

          {currentTurn?.event && (
            <div
              className={`rounded-xl border p-4 ${
                currentTurn.event.type === 'positive'
                  ? 'bg-green-500/10 border-green-500/30'
                  : currentTurn.event.type === 'negative'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-2 ${
                  currentTurn.event.type === 'positive'
                    ? 'text-green-400'
                    : currentTurn.event.type === 'negative'
                    ? 'text-red-400'
                    : 'text-blue-400'
                }`}
              >
                随机事件
              </h3>
              <div className="text-white font-medium mb-1">
                {currentTurn.event.title}
              </div>
              <div className="text-slate-400 text-sm">
                {currentTurn.event.description}
              </div>
            </div>
          )}

          <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">游戏信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">关卡名称</span>
                <span className="text-white">{history.levelName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">总回合数</span>
                <span className="text-white">
                  {history.totalTurns} / {history.maxTurns}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">最终结果</span>
                <span
                  className={
                    history.isWin ? 'text-green-400 font-medium' : 'text-red-400 font-medium'
                  }
                >
                  {history.isWin ? '胜利' : '失败'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">最终得分</span>
                <span className="text-white font-semibold">{history.finalScore}</span>
              </div>
              {history.failureReason && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-slate-400 mb-1">失败原因</div>
                  <div className="text-red-400 text-sm">
                    {history.failureReason}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Replay;
