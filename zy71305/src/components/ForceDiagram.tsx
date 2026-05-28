import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';
import { HoistPointResult } from '../types';

export function ForceDiagram() {
  const { report, points, equipment } = useHoistStore();
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const pointResults = report?.pointResults || [];

  if (points.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 h-full">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">受力示意图</h3>
        </div>
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>添加吊点后显示示意图</p>
          </div>
        </div>
      </div>
    );
  }

  const padding = 60;
  const width = 500;
  const height = 350;
  const contentWidth = width - padding * 2;
  const contentHeight = height - padding * 2;

  const allX = points.map((p) => p.x);
  const allY = points.map((p) => p.y);
  const minX = Math.min(...allX, 0);
  const maxX = Math.max(...allX, 10);
  const minY = Math.min(...allY, 0);
  const maxY = Math.max(...allY, 10);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min(contentWidth / rangeX, contentHeight / rangeY);

  const toSvgX = (x: number) => padding + (x - minX) * scale;
  const toSvgY = (y: number) => height - padding - (y - minY) * scale;

  const getResult = (pointId: string): HoistPointResult | undefined =>
    pointResults.find((r) => r.pointId === pointId);

  const getPointColor = (pointId: string) => {
    const result = getResult(pointId);
    if (!result) return '#64748b';
    if (result.cableForce === 0) return '#64748b';
    return result.isSafe ? '#22c55e' : '#ef4444';
  };

  const getEquipmentForPoint = (pointId: string) =>
    equipment.filter((e) => e.assignedPointId === pointId);

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">吊点布置与受力示意图</h3>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-slate-400">安全</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-slate-400">不安全</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-slate-500"></span>
            <span className="text-slate-400">无载荷</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#334155"
                strokeWidth="0.5"
              />
            </pattern>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
            </marker>
            <marker
              id="arrowhead-red"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
            </marker>
          </defs>

          <rect x="0" y="0" width={width} height={height} fill="#1e293b" rx="8" />
          <rect x={padding} y={padding} width={contentWidth} height={contentHeight} fill="url(#grid)" />

          {points.map((point) => {
            const cx = toSvgX(point.x);
            const cy = toSvgY(point.y);
            const result = getResult(point.id);
            const color = getPointColor(point.id);
            const isHovered = hoveredPoint === point.id;
            const angleRad = point.angle ? (point.angle * Math.PI) / 180 : Math.PI / 3;
            const cableLength = 50;

            return (
              <g key={point.id}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx - cableLength * Math.cos(angleRad)}
                  y2={cy - cableLength * Math.sin(angleRad)}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />

                {result && result.cableForce > 0 && (
                  <>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx}
                      y2={cy + 30}
                      stroke="#22c55e"
                      strokeWidth="3"
                      markerEnd="url(#arrowhead)"
                      opacity={isHovered ? 1 : 0.6}
                    />
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx + 25}
                      y2={cy}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead-red)"
                      opacity={isHovered ? 1 : 0.6}
                    />
                  </>
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 14 : 10}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredPoint(point.id)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {points.findIndex((p) => p.id === point.id) + 1}
                </text>

                <text x={cx} y={cy + 28} textAnchor="middle" fill="#94a3b8" fontSize="10">
                  {point.name}
                </text>
              </g>
            );
          })}

          <text x={padding + 5} y={height - padding - 5} fill="#64748b" fontSize="10">
            X (m)
          </text>
          <text x={padding + 15} y={padding + 15} fill="#64748b" fontSize="10">
            Y (m)
          </text>
        </svg>

        {hoveredPoint && (
          <div className="absolute top-4 right-4 bg-slate-900/95 p-3 rounded-lg border border-slate-600 text-sm min-w-48">
            {(() => {
              const point = points.find((p) => p.id === hoveredPoint);
              const result = getResult(hoveredPoint);
              const eqList = getEquipmentForPoint(hoveredPoint);
              if (!point) return null;

              return (
                <>
                  <div className="font-bold text-white mb-2">{point.name}</div>
                  <div className="space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>坐标:</span>
                      <span className="font-mono">
                        ({point.x}, {point.y}, {point.z}) m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>角度:</span>
                      <span className="font-mono">{point.angle ?? '未设置'}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>设备:</span>
                      <span className="font-mono">{eqList.reduce((s, e) => s + e.quantity, 0)} 台</span>
                    </div>
                    {result && result.cableForce > 0 && (
                      <>
                        <div className="border-t border-slate-700 my-2" />
                        <div className="flex justify-between text-green-400">
                          <span>垂直力:</span>
                          <span className="font-mono">{result.verticalForce.toFixed(3)} kN</span>
                        </div>
                        <div className="flex justify-between text-amber-400">
                          <span>水平力:</span>
                          <span className="font-mono">{result.horizontalForce.toFixed(3)} kN</span>
                        </div>
                        <div className="flex justify-between text-blue-400">
                          <span>绳力:</span>
                          <span className="font-mono">{result.cableForce.toFixed(3)} kN</span>
                        </div>
                        <div className="flex justify-between">
                          <span>安全系数:</span>
                          <span
                            className={`font-mono ${
                              result.safetyRatio >= 5
                                ? 'text-green-400'
                                : result.safetyRatio >= 3
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }`}
                          >
                            {result.safetyRatio.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-green-500"></div>
          <span>垂直分力 (Fv)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-amber-500"></div>
          <span>水平分力 (Fh)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-slate-400 border-dashed"></div>
          <span>钢丝绳</span>
        </div>
      </div>
    </div>
  );
}
