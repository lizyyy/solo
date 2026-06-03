import { useState } from 'react';
import type { AnnotationRow } from '../types';
import { StatusBadge } from './StatusBadge';
import { Eye } from 'lucide-react';

interface Crack3DViewProps {
  rows: AnnotationRow[];
  onRowClick?: (row: AnnotationRow) => void;
}

export function Crack3DView({ rows, onRowClick }: Crack3DViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const minX = Math.min(...rows.map(r => r.x3d), 0);
  const maxX = Math.max(...rows.map(r => r.x3d), 20);
  const minY = Math.min(...rows.map(r => r.y3d), 0);
  const maxY = Math.max(...rows.map(r => r.y3d), 5);
  const minZ = Math.min(...rows.map(r => r.z3d), 0);
  const maxZ = Math.max(...rows.map(r => r.z3d), 6);

  const scale = 30;
  const offsetX = 50;
  const offsetY = 300;

  const project3D = (x: number, y: number, z: number) => {
    const normalizedX = ((x - minX) / (maxX - minX)) * scale * 5;
    const normalizedY = ((y - minY) / (maxY - minY)) * scale * 2;
    const normalizedZ = ((z - minZ) / (maxZ - minZ)) * scale;

    const screenX = offsetX + normalizedX + normalizedZ * 0.3;
    const screenY = offsetY - normalizedY - normalizedZ * 0.2;

    return { x: screenX, y: screenY, depth: normalizedZ };
  };

  const sortedRows = [...rows].sort((a, b) => {
    const depthA = project3D(a.x3d, a.y3d, a.z3d).depth;
    const depthB = project3D(b.x3d, b.y3d, b.z3d).depth;
    return depthA - depthB;
  });

  const bridgeWidth = ((maxX - minX) / (maxX - minX)) * scale * 5 + 40;
  const bridgeHeight = ((maxY - minY) / (maxY - minY)) * scale * 2 + 20;

  const handleClick = (row: AnnotationRow) => {
    setSelectedId(row.id);
    onRowClick?.(row);
  };

  const getPointColor = (row: AnnotationRow) => {
    if (row.status === 'missing_row') return '#D97706';
    if (row.isOccluded) return '#6B7280';
    if (row.status === 'recalculated' || row.status === 'completed') return '#059669';
    if (row.status === 'reviewed' || row.status === 'supplemented') return '#0891B2';
    return '#1E3A8A';
  };

  return (
    <div className="card-industrial p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-600" />
          三维标注结果
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary-600" />
            <span className="text-gray-600">正常</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-warning-500 animate-blink" />
            <span className="text-gray-600">缺行待复核</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-gray-600">遮挡</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-success-500" />
            <span className="text-gray-600">已重算</span>
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-b from-sky-50 to-blue-50 border-2 border-gray-200 overflow-hidden" style={{ height: '380px' }}>
        <svg width="100%" height="100%" viewBox="0 0 600 400">
          <defs>
            <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9CA3AF" />
              <stop offset="100%" stopColor="#6B7280" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
            </filter>
          </defs>

          <rect
            x={offsetX - 20}
            y={offsetY - bridgeHeight + 10}
            width={bridgeWidth}
            height={bridgeHeight}
            fill="url(#bridgeGradient)"
            stroke="#4B5563"
            strokeWidth="2"
            filter="url(#shadow)"
          />

          {[0, 1, 2, 3, 4].map(i => (
            <line
              key={i}
              x1={offsetX - 20 + i * (bridgeWidth / 4)}
              y1={offsetY - bridgeHeight + 10}
              x2={offsetX - 20 + i * (bridgeWidth / 4)}
              y2={offsetY + 10}
              stroke="#4B5563"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {sortedRows.map((row) => {
            const pos = project3D(row.x3d, row.y3d, row.z3d);
            const isMissing = row.status === 'missing_row';
            const isHovered = hoveredId === row.id;
            const isSelected = selectedId === row.id;
            const pointSize = isHovered || isSelected ? 10 : 6;

            return (
              <g
                key={row.id}
                onMouseEnter={() => setHoveredId(row.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleClick(row)}
                style={{ cursor: 'pointer' }}
              >
                {isMissing && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={pointSize + 8}
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    className="animate-blink"
                  />
                )}

                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={pointSize + 4}
                    fill="none"
                    stroke={getPointColor(row)}
                    strokeWidth="2"
                  />
                )}

                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pointSize}
                  fill={getPointColor(row)}
                  stroke="white"
                  strokeWidth="2"
                  filter="url(#shadow)"
                  opacity={row.isOccluded ? 0.5 : 1}
                />

                {(isHovered || isSelected) && (
                  <g>
                    <rect
                      x={pos.x + 12}
                      y={pos.y - 35}
                      width="180"
                      height="30"
                      fill="white"
                      stroke="#E5E7EB"
                      strokeWidth="1"
                      rx="2"
                      filter="url(#shadow)"
                    />
                    <text x={pos.x + 20} y={pos.y - 16} fontSize="10" fill="#6B7280">
                      {row.crackId} · {row.photoNumber}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          <text x={offsetX + bridgeWidth / 2} y={offsetY + 45} fontSize="12" fill="#6B7280" textAnchor="middle">
            桥梁梁体 · X轴方向
          </text>
        </svg>
      </div>

      {selectedId && (
        <div className="mt-4 p-3 bg-gray-50 border-2 border-gray-200">
          {(() => {
            const row = rows.find(r => r.id === selectedId);
            if (!row) return null;
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-gray-800">{row.crackId}</span>
                  <span className="text-sm text-gray-600">照片：{row.photoNumber}</span>
                  <span className="font-mono text-sm text-gray-700">
                    ({row.x3d.toFixed(2)}, {row.y3d.toFixed(2)}, {row.z3d.toFixed(2)})
                  </span>
                  <StatusBadge status={row.status} />
                  {row.isOccluded && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5">遮挡</span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  关闭
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
