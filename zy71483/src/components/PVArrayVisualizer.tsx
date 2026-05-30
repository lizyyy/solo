import { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import {
  getModulePosition,
  getArrayDimensions,
  MODULE_WIDTH,
  MODULE_HEIGHT,
} from '../utils/shadingCalculator';

export function PVArrayVisualizer() {
  const {
    arrayConfig,
    shadowConfig,
    shadingResults,
    powerResults,
    updateObstacle,
    totalPower,
    totalLoss,
  } = useStore();

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const dimensions = getArrayDimensions(arrayConfig.rows, arrayConfig.cols);
  const padding = 20;

  const getShadingColor = (shadingRate: number): string => {
    if (shadingRate <= 0) return '#00B42A';
    if (shadingRate < 0.3) return '#7BCB6F';
    if (shadingRate < 0.6) return '#FFAA24';
    if (shadingRate < 0.9) return '#F55D4B';
    return '#CB2631';
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, obstacleId: string) => {
      e.preventDefault();
      const obstacle = shadowConfig.obstacles.find((o) => o.id === obstacleId);
      if (!obstacle || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setDragging(obstacleId);
      setDragOffset({
        x: x - obstacle.position.x,
        y: y - obstacle.position.y,
      });
    },
    [shadowConfig.obstacles]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      updateObstacle(dragging, {
        position: { x: Math.max(0, x), y: Math.max(0, y) },
      });
    },
    [dragging, dragOffset, updateObstacle]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header flex items-center justify-between">
        <span>光伏阵列可视化</span>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">总功率:</span>
            <span className="font-mono text-solar-600 font-semibold">
              {totalPower.toFixed(0)} W
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">损失:</span>
            <span className="font-mono text-danger-500 font-semibold">
              {totalLoss.toFixed(0)} W
            </span>
          </div>
        </div>
      </div>
      <div className="card-body flex-1 overflow-auto">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="mx-auto bg-neutral-50 rounded-lg border border-neutral-200"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <linearGradient id="moduleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1D2129" />
              <stop offset="100%" stopColor="#272E3B" />
            </linearGradient>
            <filter id="shadowBlur">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {arrayConfig.modules.map((module) => {
            const pos = getModulePosition(module.position.row, module.position.col);
            const shading = shadingResults.find((s) => s.moduleId === module.id);
            const power = powerResults.find((p) => p.moduleId === module.id);
            const shadingRate = shading?.shadingRate || 0;
            const baseColor = getShadingColor(shadingRate);

            return (
              <g
                key={module.id}
                transform={`translate(${pos.x + padding}, ${pos.y + padding})`}
              >
                <rect
                  width={MODULE_WIDTH}
                  height={MODULE_HEIGHT}
                  fill="url(#moduleGradient)"
                  rx="4"
                  stroke="#4E5969"
                  strokeWidth="1"
                />

                {Array.from({ length: 6 }).map((_, cellIndex) => (
                  <rect
                    key={cellIndex}
                    x={2}
                    y={2 + cellIndex * (MODULE_HEIGHT - 4) / 6}
                    width={MODULE_WIDTH - 4}
                    height={(MODULE_HEIGHT - 4) / 6 - 1}
                    fill={
                      shading?.affectedCells.includes(cellIndex)
                        ? `rgba(0,0,0,${0.3 + shadingRate * 0.4})`
                        : baseColor
                    }
                    opacity={shading?.affectedCells.includes(cellIndex) ? 0.9 : 0.3}
                    rx="1"
                  />
                ))}

                <rect
                  x="0"
                  y="0"
                  width={MODULE_WIDTH}
                  height={MODULE_HEIGHT}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth="3"
                  rx="4"
                  opacity="0.6"
                />

                {module.bypassDiode && (
                  <g
                    className={power?.bypassDiodeActive ? 'diode-glow' : ''}
                  >
                    <circle
                      cx={MODULE_WIDTH - 10}
                      cy={MODULE_HEIGHT - 10}
                      r="6"
                      fill={power?.bypassDiodeActive ? '#FF7D00' : '#4E5969'}
                    />
                    <text
                      x={MODULE_WIDTH - 10}
                      y={MODULE_HEIGHT - 7}
                      fontSize="8"
                      fill="white"
                      textAnchor="middle"
                    >
                      D
                    </text>
                  </g>
                )}

                <title>
                  {`组件 ${module.position.row + 1}-${
                    module.position.col + 1
                  }\n遮挡率: ${(shadingRate * 100).toFixed(1)}%\n功率: ${(
                    power?.actualPower || 0
                  ).toFixed(1)}W`}
                </title>
              </g>
            );
          })}

          {shadowConfig.obstacles.map((obstacle) => (
            <g key={obstacle.id}>
              <rect
                x={obstacle.position.x + padding}
                y={obstacle.position.y + padding}
                width={obstacle.size.width}
                height={obstacle.size.height}
                fill="rgba(0,0,0,0.6)"
                filter="url(#shadowBlur)"
                className="shadow-pulse"
              />
              <rect
                x={obstacle.position.x + padding}
                y={obstacle.position.y + padding}
                width={obstacle.size.width}
                height={obstacle.size.height}
                fill="rgba(100, 100, 100, 0.8)"
                stroke="#86909C"
                strokeWidth="2"
                strokeDasharray={dragging === obstacle.id ? '5,5' : 'none'}
                cursor="move"
                onMouseDown={(e) => handleMouseDown(e, obstacle.id)}
              />
              <text
                x={obstacle.position.x + padding + obstacle.size.width / 2}
                y={obstacle.position.y + padding + obstacle.size.height / 2 + 4}
                fontSize="10"
                fill="white"
                textAnchor="middle"
                pointerEvents="none"
              >
                遮挡物
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-solar-500" />
            <span className="text-xs text-neutral-500">0-30% 遮挡</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-warning-500" />
            <span className="text-xs text-neutral-500">30-60% 遮挡</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-danger-500" />
            <span className="text-xs text-neutral-500">60%+ 遮挡</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-warning-500" />
            <span className="text-xs text-neutral-500">二极管导通</span>
          </div>
        </div>
      </div>
    </div>
  );
}
