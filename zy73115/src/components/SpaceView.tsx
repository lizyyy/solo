import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Move, Maximize2, Crosshair } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import { CollisionPoint, CADLayer } from '../types';

const severityColors = {
  critical: '#ef4444',
  error: '#f97316',
  warning: '#f59e0b',
};

const severitySizes = {
  critical: 14,
  error: 11,
  warning: 8,
};

export const SpaceView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredCollision, setHoveredCollision] = useState<string | null>(null);

  const { session, selectedCollisionId, selectCollision, getFilteredCollisions, getLayerById } = useReviewStore();

  const collisions = getFilteredCollisions();
  const visibleLayers = session?.layers.filter(l => l.visible) || [];

  const viewBoxWidth = 30;
  const viewBoxHeight = 20;

  useEffect(() => {
    if (selectedCollisionId && svgRef.current) {
      const collision = collisions.find(c => c.id === selectedCollisionId);
      if (collision) {
        const centerX = viewBoxWidth / 2;
        const centerY = viewBoxHeight / 2;
        setOffset({
          x: centerX - collision.position.x,
          y: centerY - collision.position.y,
        });
      }
    }
  }, [selectedCollisionId, collisions]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.5, Math.min(3, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x * scale, y: e.clientY - offset.y * scale });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: (e.clientX - panStart.x) / scale,
        y: (e.clientY - panStart.y) / scale,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomIn = () => setScale(s => Math.min(3, s * 1.2));
  const zoomOut = () => setScale(s => Math.max(0.5, s / 1.2));

  const getLayerRects = () => {
    const rects: { layer: CADLayer; x: number; y: number; width: number; height: number }[] = [];
    const layerLayouts = [
      { x: 3, y: 2, width: 10, height: 5 },
      { x: 2, y: 8, width: 8, height: 4 },
      { x: 12, y: 3, width: 7, height: 5 },
      { x: 14, y: 9, width: 9, height: 4 },
      { x: 5, y: 13, width: 8, height: 5 },
      { x: 15, y: 14, width: 6, height: 4 },
      { x: 1, y: 15, width: 5, height: 3 },
    ];

    visibleLayers.forEach((layer, idx) => {
      const layout = layerLayouts[idx % layerLayouts.length];
      rects.push({
        layer,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      });
    });

    return rects;
  };

  const layerRects = getLayerRects();

  if (!session) return null;

  return (
    <div className="h-full flex flex-col bg-slate-950 relative">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="w-8 h-8 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition-colors"
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition-colors"
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition-colors"
          title="重置视图"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div className="absolute top-4 left-4 z-10 px-3 py-2 bg-slate-800/90 rounded text-xs text-slate-400 font-mono">
        缩放: {(scale * 100).toFixed(0)}%
      </div>

      <div
        className="flex-1 cursor-move overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="select-none"
          style={{
            transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#1e293b" strokeWidth="0.02" />
            </pattern>
            <pattern id="grid-major" width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" fill="url(#grid)" />
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#334155" strokeWidth="0.03" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.1" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#grid-major)" />

          {layerRects.map(({ layer, x, y, width, height }) => (
            <g key={layer.id}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={layer.color}
                fillOpacity="0.15"
                stroke={layer.color}
                strokeOpacity="0.4"
                strokeWidth="0.05"
                rx="0.1"
              />
              <text
                x={x + width / 2}
                y={y + height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={layer.color}
                fontSize="0.3"
                fontFamily="monospace"
                opacity="0.7"
              >
                {layer.name.slice(-6)}
              </text>
            </g>
          ))}

          {collisions.map((collision) => {
            const isSelected = selectedCollisionId === collision.id;
            const isHovered = hoveredCollision === collision.id;
            const size = severitySizes[collision.severity] * (isSelected || isHovered ? 1.3 : 1);
            const color = severityColors[collision.severity];
            const layerA = getLayerById(collision.layerIdA);
            const layerB = getLayerById(collision.layerIdB);

            return (
              <g
                key={collision.id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCollision(collision.id);
                }}
                onMouseEnter={() => setHoveredCollision(collision.id)}
                onMouseLeave={() => setHoveredCollision(null)}
                style={{ cursor: 'pointer' }}
              >
                {collision.isBoundary ? (
                  <circle
                    cx={collision.position.x}
                    cy={collision.position.y}
                    r={size / 30}
                    fill="#f59e0b"
                    fillOpacity="0.3"
                    stroke="#f59e0b"
                    strokeWidth="0.05"
                    strokeDasharray="0.15 0.1"
                    filter={isSelected ? 'url(#glow)' : undefined}
                  />
                ) : (
                  <circle
                    cx={collision.position.x}
                    cy={collision.position.y}
                    r={size / 30}
                    fill={color}
                    fillOpacity={isSelected ? 0.9 : 0.7}
                    stroke={color}
                    strokeWidth="0.03"
                    filter={isSelected ? 'url(#glow)' : undefined}
                  />
                )}

                {collision.duplicateOf && (
                  <circle
                    cx={collision.position.x}
                    cy={collision.position.y}
                    r={(size + 4) / 30}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="0.03"
                    strokeDasharray="0.1 0.08"
                  />
                )}

                {isSelected && (
                  <circle
                    cx={collision.position.x}
                    cy={collision.position.y}
                    r={(size + 8) / 30}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="0.04"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="r"
                      values={`${(size + 6) / 30};${(size + 12) / 30};${(size + 6) / 30}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0.2;0.8"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {(isHovered || isSelected) && (
                  <g>
                    <rect
                      x={collision.position.x + 0.3}
                      y={collision.position.y - 1.2}
                      width="4"
                      height="0.9"
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="0.03"
                      rx="0.1"
                    />
                    <text
                      x={collision.position.x + 0.5}
                      y={collision.position.y - 0.75}
                      fill="#e2e8f0"
                      fontSize="0.25"
                      fontFamily="monospace"
                    >
                      位置: ({collision.position.x.toFixed(1)}, {collision.position.y.toFixed(1)})
                    </text>
                    <text
                      x={collision.position.x + 0.5}
                      y={collision.position.y - 0.45}
                      fill="#94a3b8"
                      fontSize="0.2"
                      fontFamily="monospace"
                    >
                      {layerA?.name.slice(0, 8)} × {layerB?.name.slice(0, 8)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          <g transform={`translate(1, ${viewBoxHeight - 2})`}>
            <line x1="0" y1="0" x2="5" y2="0" stroke="#64748b" strokeWidth="0.05" />
            <line x1="0" y1="-0.15" x2="0" y2="0.15" stroke="#64748b" strokeWidth="0.05" />
            <line x1="5" y1="-0.15" x2="5" y2="0.15" stroke="#64748b" strokeWidth="0.05" />
            <text x="2.5" y="0.5" fill="#64748b" fontSize="0.25" textAnchor="middle" fontFamily="monospace">
              5m
            </text>
          </g>
        </svg>
      </div>

      <div className="absolute bottom-4 left-4 z-10 px-3 py-2 bg-slate-800/90 rounded">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-slate-400">严重</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="text-slate-400">错误</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">警告</span>
          </div>
          <div className="w-px h-4 bg-slate-600"></div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-amber-400 bg-amber-400/20"></span>
            <span className="text-slate-400">边界</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-blue-400"></span>
            <span className="text-slate-400">重复</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 px-3 py-2 bg-slate-800/90 rounded text-xs text-slate-400 flex items-center gap-2">
        <Move size={12} />
        拖拽平移 · 滚轮缩放 · 点击选中
      </div>
    </div>
  );
};
