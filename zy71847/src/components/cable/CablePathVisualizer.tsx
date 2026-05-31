import React, { useState } from 'react';
import { Point } from '@/types';
import { FlipVertical, FlipHorizontal, RefreshCw } from 'lucide-react';

interface CablePathVisualizerProps {
  startPoint: Point;
  endPoint: Point;
  cableNo: string;
  cabinet: string;
  isFlipped?: boolean;
}

export const CablePathVisualizer: React.FC<CablePathVisualizerProps> = ({
  startPoint,
  endPoint,
  cableNo,
  cabinet,
  isFlipped = false,
}) => {
  const [flipY, setFlipY] = useState(false);
  const [flipX, setFlipX] = useState(false);

  const gridSize = 10;
  const padding = 40;
  const width = 400;
  const height = 300;

  const transformPoint = (point: Point): Point => {
    let x = point.x;
    let y = point.y;
    if (flipX) x = -x;
    if (flipY) y = -y;
    return { x, y };
  };

  const toCanvasCoord = (point: Point): Point => {
    const transformed = transformPoint(point);
    return {
      x: padding + (transformed.x + 50) * (width - 2 * padding) / 100,
      y: padding + (50 - transformed.y) * (height - 2 * padding) / 100,
    };
  };

  const start = toCanvasCoord(startPoint);
  const end = toCanvasCoord(endPoint);

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2 + 30;
  const pathD = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

  const renderGrid = () => {
    const lines = [];
    for (let i = 0; i <= 10; i++) {
      const x = padding + i * (width - 2 * padding) / 10;
      const y = padding + i * (height - 2 * padding) / 10;
      lines.push(
        <line key={`v-${i}`} x1={x} y1={padding} x2={x} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
      );
      lines.push(
        <line key={`h-${i}`} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
      );
    }
    lines.push(
      <line key="x-axis" x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#94a3b8" strokeWidth="1.5" />
    );
    lines.push(
      <line key="y-axis" x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} stroke="#94a3b8" strokeWidth="1.5" />
    );
    return lines;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-800">{cableNo}</h4>
          <p className="text-xs text-gray-500">{cabinet} 机柜</p>
        </div>
        <div className="flex items-center gap-2">
          {isFlipped && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              坐标已修正
            </span>
          )}
          <button
            onClick={() => setFlipY(!flipY)}
            className={`p-1.5 rounded border transition-colors ${
              flipY ? 'bg-signal-blue text-white border-signal-blue' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
            title="翻转Y轴"
          >
            <FlipVertical className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFlipX(!flipX)}
            className={`p-1.5 rounded border transition-colors ${
              flipX ? 'bg-signal-blue text-white border-signal-blue' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
            title="翻转X轴"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <svg width={width} height={height} className="bg-gray-50 rounded-lg border border-gray-100">
        {renderGrid()}

        <path
          d={pathD}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeLinecap="round"
          className="drop-shadow-sm"
        />

        <circle cx={start.x} cy={start.y} r="8" fill="#10B981" stroke="white" strokeWidth="2" />
        <circle cx={end.x} cy={end.y} r="8" fill="#EF4444" stroke="white" strokeWidth="2" />

        <text x={start.x} y={start.y - 12} textAnchor="middle" className="text-xs" fill="#374151" fontSize="11" fontWeight="500">
          起点 ({transformPoint(startPoint).x}, {transformPoint(startPoint).y})
        </text>
        <text x={end.x} y={end.y - 12} textAnchor="middle" className="text-xs" fill="#374151" fontSize="11" fontWeight="500">
          终点 ({transformPoint(endPoint).x}, {transformPoint(endPoint).y})
        </text>

        <text x={width - padding} y={height / 2 + 20} textAnchor="end" fill="#64748b" fontSize="10">X →</text>
        <text x={width / 2 + 5} y={padding + 15} fill="#64748b" fontSize="10">Y ↑</text>
      </svg>

      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-signal-green" />
          <span>起点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-signal-blue" />
          <span>线缆路径</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-signal-red" />
          <span>终点</span>
        </div>
      </div>
    </div>
  );
};
