import { useState, useMemo } from 'react';
import type { DriftPoint, AnomalyRegion } from '../../shared/types';
import { cn } from '@/lib/utils';

interface DriftCurveProps {
  driftCurve: DriftPoint[];
  threshold: number;
  anomalyRegions: AnomalyRegion[];
  height?: number;
}

const MARGIN = { top: 20, right: 60, bottom: 40, left: 60 };

export default function DriftCurve({
  driftCurve,
  threshold,
  anomalyRegions,
  height = 300,
}: DriftCurveProps) {
  const [hoveredPoint, setHoveredPoint] = useState<DriftPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { width, innerWidth, innerHeight, xScale, yScale, yMin, yMax } = useMemo(() => {
    if (driftCurve.length === 0) {
      return {
        width: 0,
        innerWidth: 0,
        innerHeight: 0,
        xScale: () => 0,
        yScale: () => 0,
        yMin: -threshold,
        yMax: threshold,
      };
    }

    const maxTime = Math.max(...driftCurve.map((d) => d.timeMs)) / 1000;
    const allDriftValues = driftCurve.flatMap((d) => [d.driftMs, d.cumulativeDriftMs]);
    const yMin = Math.min(...allDriftValues, -threshold) * 1.1;
    const yMax = Math.max(...allDriftValues, threshold) * 1.1;

    const innerWidth = 800 - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    const xScale = (timeMs: number) => (timeMs / 1000 / maxTime) * innerWidth;
    const yScale = (value: number) =>
      innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;

    return {
      width: innerWidth + MARGIN.left + MARGIN.right,
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      yMin,
      yMax,
    };
  }, [driftCurve, threshold, height]);

  const isPointInAnomaly = (timeMs: number) => {
    return anomalyRegions.some(
      (region) => timeMs >= region.startMs && timeMs <= region.endMs
    );
  };

  const curvePath = useMemo(() => {
    if (driftCurve.length < 2) return '';

    return driftCurve
      .map((point, i) => {
        const x = xScale(point.timeMs) + MARGIN.left;
        const y = yScale(point.cumulativeDriftMs) + MARGIN.top;
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');
  }, [driftCurve, xScale, yScale]);

  const yTickValues = useMemo(() => {
    const ticks: number[] = [];
    const range = yMax - yMin;
    const step = range / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(yMin + step * i);
    }
    return ticks;
  }, [yMin, yMax]);

  const xTickValues = useMemo(() => {
    if (driftCurve.length === 0) return [];
    const maxTime = Math.max(...driftCurve.map((d) => d.timeMs)) / 1000;
    const ticks: number[] = [];
    const step = maxTime / 6;
    for (let i = 0; i <= 6; i++) {
      ticks.push(step * i);
    }
    return ticks;
  }, [driftCurve]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (driftCurve.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - MARGIN.left;
    const maxTime = Math.max(...driftCurve.map((d) => d.timeMs));
    const targetTime = (x / innerWidth) * maxTime;

    let closestPoint = driftCurve[0];
    let minDistance = Math.abs(driftCurve[0].timeMs - targetTime);

    for (const point of driftCurve) {
      const distance = Math.abs(point.timeMs - targetTime);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    setHoveredPoint(closestPoint);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (driftCurve.length === 0) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center rounded-lg border border-charcoal-600 bg-charcoal-800'
        )}
        style={{ height }}
      >
        <span className="text-charcoal-400">暂无漂移数据</span>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-charcoal-600 bg-charcoal-800 p-4">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
      >
        <defs>
          <pattern id="grid" width={innerWidth / 6} height={innerHeight / 5} patternUnits="userSpaceOnUse">
            <path
              d={`M ${innerWidth / 6} 0 L 0 0 0 ${innerHeight / 5}`}
              fill="none"
              stroke="#2A2A3A"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={innerWidth}
          height={innerHeight}
          fill="url(#grid)"
        />

        {anomalyRegions.map((region) => {
          const x1 = xScale(region.startMs) + MARGIN.left;
          const x2 = xScale(region.endMs) + MARGIN.left;
          return (
            <rect
              key={region.id}
              x={x1}
              y={MARGIN.top}
              width={x2 - x1}
              height={innerHeight}
              fill="rgba(239, 68, 68, 0.15)"
              className="pointer-events-none"
            />
          );
        })}

        <line
          x1={MARGIN.left}
          y1={yScale(0) + MARGIN.top}
          x2={MARGIN.left + innerWidth}
          y2={yScale(0) + MARGIN.top}
          stroke="#3A3A4A"
          strokeWidth="1"
          className="pointer-events-none"
        />

        <line
          x1={MARGIN.left}
          y1={yScale(threshold) + MARGIN.top}
          x2={MARGIN.left + innerWidth}
          y2={yScale(threshold) + MARGIN.top}
          stroke="#5E5E70"
          strokeWidth="1"
          strokeDasharray="5,5"
          className="pointer-events-none"
        />
        <text
          x={MARGIN.left + innerWidth + 5}
          y={yScale(threshold) + MARGIN.top + 4}
          fill="#5E5E70"
          fontSize="10"
          className="pointer-events-none"
        >
          +{threshold}ms
        </text>

        <line
          x1={MARGIN.left}
          y1={yScale(-threshold) + MARGIN.top}
          x2={MARGIN.left + innerWidth}
          y2={yScale(-threshold) + MARGIN.top}
          stroke="#5E5E70"
          strokeWidth="1"
          strokeDasharray="5,5"
          className="pointer-events-none"
        />
        <text
          x={MARGIN.left + innerWidth + 5}
          y={yScale(-threshold) + MARGIN.top + 4}
          fill="#5E5E70"
          fontSize="10"
          className="pointer-events-none"
        >
          -{threshold}ms
        </text>

        {yTickValues.map((value) => (
          <g key={value}>
            <line
              x1={MARGIN.left - 5}
              y1={yScale(value) + MARGIN.top}
              x2={MARGIN.left}
              y2={yScale(value) + MARGIN.top}
              stroke="#3A3A4A"
              strokeWidth="1"
            />
            <text
              x={MARGIN.left - 8}
              y={yScale(value) + MARGIN.top + 3}
              fill="#5E5E70"
              fontSize="10"
              textAnchor="end"
            >
              {value.toFixed(1)}
            </text>
          </g>
        ))}

        {xTickValues.map((value) => (
          <g key={value}>
            <line
              x1={xScale(value * 1000) + MARGIN.left}
              y1={MARGIN.top + innerHeight}
              x2={xScale(value * 1000) + MARGIN.left}
              y2={MARGIN.top + innerHeight + 5}
              stroke="#3A3A4A"
              strokeWidth="1"
            />
            <text
              x={xScale(value * 1000) + MARGIN.left}
              y={MARGIN.top + innerHeight + 18}
              fill="#5E5E70"
              fontSize="10"
              textAnchor="middle"
            >
              {value.toFixed(1)}s
            </text>
          </g>
        ))}

        <text
          x={MARGIN.left - 40}
          y={height / 2}
          fill="#5E5E70"
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90, ${MARGIN.left - 40}, ${height / 2})`}
        >
          漂移量 (ms)
        </text>
        <text
          x={width / 2}
          y={height - 5}
          fill="#5E5E70"
          fontSize="11"
          textAnchor="middle"
        >
          时间 (秒)
        </text>

        <path
          d={curvePath}
          fill="none"
          stroke="#00F5D4"
          strokeWidth="2"
          className="pointer-events-none"
        />

        {hoveredPoint && (
          <line
            x1={xScale(hoveredPoint.timeMs) + MARGIN.left}
            y1={MARGIN.top}
            x2={xScale(hoveredPoint.timeMs) + MARGIN.left}
            y2={MARGIN.top + innerHeight}
            stroke="#00F5D4"
            strokeWidth="1"
            opacity="0.5"
            className="pointer-events-none"
          />
        )}

        {driftCurve.map((point, index) => {
          const isAnomaly = isPointInAnomaly(point.timeMs);
          const cx = xScale(point.timeMs) + MARGIN.left;
          const cy = yScale(point.cumulativeDriftMs) + MARGIN.top;
          const isHovered = hoveredPoint?.timeMs === point.timeMs;

          return (
            <g key={`${point.timeMs}-${index}`}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5 : 3}
                fill={isAnomaly ? '#EF4444' : '#00F5D4'}
                stroke={isAnomaly ? '#EF4444' : '#00F5D4'}
                strokeWidth="1"
                className="transition-all duration-150"
              />
              {isHovered && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill="none"
                  stroke={isAnomaly ? '#EF4444' : '#00F5D4'}
                  strokeWidth="2"
                  opacity="0.5"
                />
              )}
            </g>
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-charcoal-600 bg-charcoal-700 px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(mousePos.x + 10, width - 160),
            top: Math.min(mousePos.y + 10, height - 100),
          }}
        >
          <div className="font-medium text-charcoal-100">
            时间: {(hoveredPoint.timeMs / 1000).toFixed(2)}s
          </div>
          <div className="text-charcoal-300">
            瞬时漂移:{' '}
            <span
              className={cn(
                'font-mono',
                Math.abs(hoveredPoint.driftMs) > threshold
                  ? 'text-red-400'
                  : 'text-cyan-300'
              )}
            >
              {hoveredPoint.driftMs > 0 ? '+' : ''}
              {hoveredPoint.driftMs.toFixed(2)}ms
            </span>
          </div>
          <div className="text-charcoal-300">
            累计漂移:{' '}
            <span
              className={cn(
                'font-mono',
                Math.abs(hoveredPoint.cumulativeDriftMs) > threshold
                  ? 'text-red-400'
                  : 'text-cyan-300'
              )}
            >
              {hoveredPoint.cumulativeDriftMs > 0 ? '+' : ''}
              {hoveredPoint.cumulativeDriftMs.toFixed(2)}ms
            </span>
          </div>
          {isPointInAnomaly(hoveredPoint.timeMs) && (
            <div className="mt-1 text-red-400">⚠ 异常区域</div>
          )}
        </div>
      )}
    </div>
  );
}
