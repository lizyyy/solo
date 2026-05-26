import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Restaurant as RestaurantType,
  Station as StationType,
  Truck as TruckType,
  RouteNode,
  Level,
  Position,
} from '../../types/game';
import styles from './GameMap.module.css';

interface GameMapProps {
  level: Level | null;
  restaurants: RestaurantType[];
  station: StationType | null;
  truck: TruckType | null;
  plannedRoute: RouteNode[];
  onNodeClick: (node: RouteNode) => void;
  gridSize: { width: number; height: number };
  isAnimating: boolean;
  hoveredNode: RouteNode | null;
  onNodeHover: (node: RouteNode | null) => void;
}

interface HoveredInfo {
  node: RouteNode;
  screenX: number;
  screenY: number;
  data: RestaurantType | StationType | null;
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

const GameMap: React.FC<GameMapProps> = ({
  level,
  restaurants,
  station,
  truck,
  plannedRoute,
  onNodeClick,
  gridSize,
  isAnimating,
  hoveredNode,
  onNodeHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredInfo, setHoveredInfo] = useState<HoveredInfo | null>(null);
  const [displayTruckPos, setDisplayTruckPos] = useState<Position | null>(null);

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
    if (!truck) return;
    setDisplayTruckPos(truck.position);
  }, [truck]);

  useEffect(() => {
    if (!truck || !displayTruckPos || !isAnimating) return;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let animationId: number;
    let startTime: number | null = null;
    const startPos = { ...displayTruckPos };
    const targetPos = truck.position;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const duration = 800;
      const t = Math.min(elapsed / duration, 1);
      const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      setDisplayTruckPos({
        x: lerp(startPos.x, targetPos.x, easeT),
        y: lerp(startPos.y, targetPos.y, easeT),
      });

      if (t < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [truck?.position.x, truck?.position.y, isAnimating]);

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
        const isHovered = hoveredNode?.id === restaurant.id;

        if (isInRoute) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        if (isHovered) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
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
        const isHovered = hoveredNode?.id === station.id;

        if (isInRoute) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, NODE_RADIUS + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        if (isHovered) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, NODE_RADIUS + 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
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

      if (displayTruckPos) {
        const pos = gridToScreen(displayTruckPos);

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
    displayTruckPos,
    plannedRoute,
    hoveredNode,
    gridToScreen,
  ]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const node = findNodeAtPosition(e.clientX, e.clientY);
      if (node) {
        onNodeClick(node);
      }
    },
    [findNodeAtPosition, onNodeClick]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const node = findNodeAtPosition(e.clientX, e.clientY);

      if (node) {
        onNodeHover(node);
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
        onNodeHover(null);
        setHoveredInfo(null);
      }
    },
    [findNodeAtPosition, onNodeHover, restaurants, station]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    onNodeHover(null);
    setHoveredInfo(null);
  }, [onNodeHover]);

  const totalDistance = useMemo(() => {
    if (!truck || plannedRoute.length === 0) return 0;
    let distance = 0;
    let prevPos = truck.position;
    for (const node of plannedRoute) {
      distance += calculateDistance(prevPos, node.position);
      prevPos = node.position;
    }
    return Math.round(distance * 10) / 10;
  }, [truck, plannedRoute]);

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
    <div ref={containerRef} className={styles.gameMapContainer}>
      <canvas
        ref={canvasRef}
        className={styles.gameCanvas}
        onClick={handleCanvasClick}
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
            className={styles.tooltip}
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className={styles.tooltipHeader}>
              <span>{hoveredInfo.node.type === 'restaurant' ? '🍽️' : '♻️'}</span>
              <span className={styles.tooltipTitle}>
                {hoveredInfo.data.name}
              </span>
            </div>
            <div className={styles.tooltipContent}>
              {hoveredInfo.node.type === 'restaurant' ? (
                <>
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipLabel}>当前油量</span>
                    <span className={styles.tooltipValue}>
                      {(hoveredInfo.data as RestaurantType).currentOil} /{' '}
                      {(hoveredInfo.data as RestaurantType).barrelCapacity} L
                    </span>
                  </div>
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipLabel}>容量占比</span>
                    <span
                      className={styles.tooltipValue}
                      style={{
                        color: getCapacityColor(
                          ((hoveredInfo.data as RestaurantType).currentOil /
                            (hoveredInfo.data as RestaurantType).barrelCapacity) *
                            100
                        ),
                      }}
                    >
                      {Math.round(
                        ((hoveredInfo.data as RestaurantType).currentOil /
                          (hoveredInfo.data as RestaurantType).barrelCapacity) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className={styles.capacityBar}>
                    <div
                      className={styles.capacityFill}
                      style={{
                        width: `${Math.round(
                          ((hoveredInfo.data as RestaurantType).currentOil /
                            (hoveredInfo.data as RestaurantType).barrelCapacity) *
                            100
                        )}%`,
                        backgroundColor: getCapacityColor(
                          ((hoveredInfo.data as RestaurantType).currentOil /
                            (hoveredInfo.data as RestaurantType).barrelCapacity) *
                            100
                        ),
                      }}
                    />
                  </div>
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipLabel}>每回合产油</span>
                    <span className={styles.tooltipValue}>
                      +{(hoveredInfo.data as RestaurantType).oilPerTurn} L
                    </span>
                  </div>
                </>
              ) : (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>类型</span>
                  <span className={styles.tooltipValue}>回收站</span>
                </div>
              )}
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>位置</span>
                <span className={styles.tooltipValue}>
                  ({hoveredInfo.data.position.x}, {hoveredInfo.data.position.y})
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{ backgroundColor: '#22c55e' }} />
          <span>油量正常 ({'<'}60%)</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{ backgroundColor: '#f59e0b' }} />
          <span>油量偏高 (60-90%)</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{ backgroundColor: '#ef4444' }} />
          <span>油量过高 ({'>'}90%)</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{ backgroundColor: '#8b5cf6' }} />
          <span>回收站</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{ backgroundColor: '#22c55e' }} />
          <span>回收车</span>
        </div>
      </div>

      <div className={styles.routeInfo}>
        <div className={styles.routeInfoRow}>
          <span>已规划节点</span>
          <span className={styles.routeInfoValue}>{plannedRoute.length}</span>
        </div>
        <div className={styles.routeInfoRow}>
          <span>预计距离</span>
          <span className={styles.routeInfoValue}>{totalDistance}</span>
        </div>
        {truck && (
          <div className={styles.routeInfoRow}>
            <span>最大距离</span>
            <span className={styles.routeInfoValue}>{truck.maxDistancePerTurn}</span>
          </div>
        )}
        {truck && (
          <div className={styles.routeInfoRow}>
            <span>载重</span>
            <span className={styles.routeInfoValue}>
              {truck.currentLoad} / {truck.capacity}
            </span>
          </div>
        )}
      </div>

      {level && (
        <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
          <div className="text-sm text-slate-400">关卡</div>
          <div className="text-lg font-semibold text-white">{level.name}</div>
        </div>
      )}
    </div>
  );
};

export default GameMap;
