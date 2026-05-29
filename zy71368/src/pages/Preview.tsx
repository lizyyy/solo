import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move, Info } from 'lucide-react';
import { useExhibitionStore } from '@/store/useExhibitionStore';
import type { Artwork, Obstacle } from '@/types';
import type { ObstacleType } from '@/types';

const OBSTACLE_TYPE_LABEL: Record<ObstacleType, string> = {
  switch: '开关',
  fire_extinguisher: '灭火器',
  pipe: '管道',
  outlet: '插座',
  other: '其他',
};

export default function Preview() {
  const { wall, artworks, obstacles, moveArtwork } = useExhibitionStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGuides, setShowGuides] = useState(true);

  const selectedArtwork = useMemo(
    () => artworks.find((a) => a.id === selectedId) || null,
    [artworks, selectedId]
  );

  const sortedArtworks = useMemo(
    () => [...artworks].sort((a, b) => a.orderIndex - b.orderIndex),
    [artworks]
  );

  const canvasPadding = 40;
  const svgW = wall.width + canvasPadding * 2;
  const svgH = wall.height + canvasPadding * 2;

  const displayW = svgW * zoom;
  const displayH = svgH * zoom;

  const toSvgX = (cm: number) => cm + canvasPadding;
  const toSvgY = (cm: number) => wall.height - cm + canvasPadding;

  const svgToCmX = (svgX: number) => Math.max(0, Math.min(wall.width, svgX - canvasPadding));
  const svgToCmY = (svgY: number) =>
    Math.max(0, Math.min(wall.height, wall.height - (svgY - canvasPadding)));

  const getSvgPoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * svgW;
      const y = ((e.clientY - rect.top) / rect.height) * svgH;
      return { x, y };
    },
    [svgW, svgH]
  );

  const handleArtworkMouseDown = useCallback(
    (e: React.MouseEvent, artwork: Artwork) => {
      e.stopPropagation();
      const pt = getSvgPoint(e);
      const offsetX = pt.x - toSvgX(artwork.posX);
      const offsetY = pt.y - toSvgY(artwork.posY + artwork.frameHeight);
      setDragOffset({ x: offsetX, y: offsetY });
      setDraggingId(artwork.id);
      setSelectedId(artwork.id);
    },
    [getSvgPoint]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingId || !svgRef.current) return;
      const pt = getSvgPoint(e);
      const draggingArtwork = artworks.find((a) => a.id === draggingId);
      if (!draggingArtwork) return;

      const newPosX = Math.round(svgToCmX(pt.x - dragOffset.x));
      const newPosY = Math.round(
        svgToCmY(pt.y - dragOffset.y) - draggingArtwork.frameHeight
      );
      const clampedX = Math.max(
        0,
        Math.min(wall.width - draggingArtwork.frameWidth, newPosX)
      );
      const clampedY = Math.max(
        wall.floorOffset,
        Math.min(wall.height - draggingArtwork.frameHeight, newPosY)
      );

      moveArtwork(draggingId, clampedX, clampedY);
    },
    [draggingId, dragOffset, getSvgPoint, artworks, wall, moveArtwork]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  useEffect(() => {
    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingId, handleMouseMove, handleMouseUp]);

  const handleFitToWall = () => {
    setZoom(1);
    setSelectedId(null);
  };

  const collisionArtworks = artworks.filter((a) => a.hasCollision);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-9">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-['Playfair_Display',serif] text-xl font-semibold text-[#2C2C2C]">
              展线预览
            </h2>
            <p className="mt-0.5 text-xs text-[#2C2C2C]/40">
              拖拽画框调整位置，实时检测碰撞和视线偏差
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#D4CFC4]/60 bg-white p-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
                className="flex h-8 w-8 items-center justify-center rounded text-[#2C2C2C]/60 transition-colors hover:bg-[#FAFAF7] hover:text-[#2C2C2C]"
                title="缩小"
              >
                <ZoomOut size={15} />
              </button>
              <span className="min-w-[60px] text-center text-xs font-mono text-[#2C2C2C]/60">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                className="flex h-8 w-8 items-center justify-center rounded text-[#2C2C2C]/60 transition-colors hover:bg-[#FAFAF7] hover:text-[#2C2C2C]"
                title="放大"
              >
                <ZoomIn size={15} />
              </button>
            </div>
            <button
              onClick={handleFitToWall}
              className="flex h-8 items-center gap-1 rounded-lg border border-[#D4CFC4]/60 bg-white px-3 text-xs text-[#2C2C2C]/60 transition-colors hover:bg-[#FAFAF7] hover:text-[#2C2C2C]"
            >
              <Maximize2 size={14} />
              适配
            </button>
            <label className="flex items-center gap-1.5 rounded-lg border border-[#D4CFC4]/60 bg-white px-3 py-2 text-xs text-[#2C2C2C]/60">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="h-3 w-3 rounded border-[#D4CFC4] text-[#C4623A] focus:ring-0"
              />
              辅助线
            </label>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border border-[#D4CFC4]/60 bg-white p-4">
          <div
            className="relative overflow-hidden rounded bg-[#FAFAF7]"
            style={{ width: displayW, height: displayH }}
          >
            <svg
              ref={svgRef}
              width={displayW}
              height={displayH}
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="cursor-crosshair"
              onClick={() => setSelectedId(null)}
              style={{ userSelect: 'none' }}
            >
              <rect
                x={canvasPadding}
                y={canvasPadding}
                width={wall.width}
                height={wall.height}
                fill="#F5F3EE"
                stroke="#D4CFC4"
                strokeWidth={1}
              />

              {showGuides &&
                Array.from({ length: Math.floor(wall.height / 50) + 1 }).map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1={canvasPadding}
                    y1={toSvgY(i * 50)}
                    x2={svgW - canvasPadding}
                    y2={toSvgY(i * 50)}
                    stroke="#D4CFC4"
                    strokeWidth={0.4}
                    strokeDasharray="3,3"
                  />
                ))}
              {showGuides &&
                Array.from({ length: Math.floor(wall.width / 50) + 1 }).map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={toSvgX(i * 50)}
                    y1={canvasPadding}
                    x2={toSvgX(i * 50)}
                    y2={svgH - canvasPadding}
                    stroke="#D4CFC4"
                    strokeWidth={0.4}
                    strokeDasharray="3,3"
                  />
                ))}

              {showGuides && (
                <>
                  <line
                    x1={canvasPadding}
                    y1={toSvgY(wall.sightLineHeight)}
                    x2={svgW - canvasPadding}
                    y2={toSvgY(wall.sightLineHeight)}
                    stroke="#C4623A"
                    strokeWidth={1}
                    strokeDasharray="6,3"
                    opacity={0.8}
                  />
                  <g>
                    <rect
                      x={canvasPadding}
                      y={toSvgY(wall.sightLineHeight) - 10}
                      width={65}
                      height={18}
                      fill="#C4623A"
                      opacity={0.8}
                    />
                    <text
                      x={canvasPadding + 5}
                      y={toSvgY(wall.sightLineHeight) + 3}
                      fill="white"
                      fontSize={10}
                      fontFamily="monospace"
                      fontWeight={500}
                    >
                      视线 {wall.sightLineHeight}cm
                    </text>
                  </g>
                </>
              )}

              {showGuides &&
                Array.from({ length: Math.floor(wall.width / 100) + 1 }).map((_, i) => (
                  <g key={`scale-${i}`}>
                    <line
                      x1={toSvgX(i * 100)}
                      y1={svgH - canvasPadding}
                      x2={toSvgX(i * 100)}
                      y2={svgH - canvasPadding + 8}
                      stroke="#2C2C2C"
                      strokeWidth={0.5}
                    />
                    <text
                      x={toSvgX(i * 100)}
                      y={svgH - canvasPadding + 20}
                      fill="#2C2C2C"
                      fontSize={9}
                      fontFamily="monospace"
                      textAnchor="middle"
                      opacity={0.5}
                    >
                      {i * 100}
                    </text>
                  </g>
                ))}

              {obstacles.map((obs) => (
                <ObstacleNode key={obs.id} obstacle={obs} toSvgX={toSvgX} toSvgY={toSvgY} />
              ))}

              {sortedArtworks.map((artwork) => (
                <ArtworkNode
                  key={artwork.id}
                  artwork={artwork}
                  toSvgX={toSvgX}
                  toSvgY={toSvgY}
                  isSelected={selectedId === artwork.id}
                  isDragging={draggingId === artwork.id}
                  onMouseDown={handleArtworkMouseDown}
                />
              ))}

              {draggingId && selectedArtwork && showGuides && (
                <>
                  <line
                    x1={toSvgX(selectedArtwork.posX)}
                    y1={0}
                    x2={toSvgX(selectedArtwork.posX)}
                    y2={svgH}
                    stroke="#2C2C2C"
                    strokeWidth={0.3}
                    strokeDasharray="2,2"
                    opacity={0.5}
                  />
                  <line
                    x1={toSvgX(selectedArtwork.posX + selectedArtwork.frameWidth)}
                    y1={0}
                    x2={toSvgX(selectedArtwork.posX + selectedArtwork.frameWidth)}
                    y2={svgH}
                    stroke="#2C2C2C"
                    strokeWidth={0.3}
                    strokeDasharray="2,2"
                    opacity={0.5}
                  />
                  <line
                    x1={0}
                    y1={toSvgY(selectedArtwork.posY + selectedArtwork.frameHeight)}
                    x2={svgW}
                    y2={toSvgY(selectedArtwork.posY + selectedArtwork.frameHeight)}
                    stroke="#2C2C2C"
                    strokeWidth={0.3}
                    strokeDasharray="2,2"
                    opacity={0.5}
                  />
                  <line
                    x1={0}
                    y1={toSvgY(selectedArtwork.posY)}
                    x2={svgW}
                    y2={toSvgY(selectedArtwork.posY)}
                    stroke="#2C2C2C"
                    strokeWidth={0.3}
                    strokeDasharray="2,2"
                    opacity={0.5}
                  />
                </>
              )}
            </svg>

            <div className="absolute right-3 bottom-3 rounded bg-black/60 px-2 py-1 text-[10px] font-mono text-white">
              {displayW.toFixed(0)} × {displayH.toFixed(0)} px
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#2C2C2C]/50">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border border-[#2C2C2C] bg-[#FAFAF7]" />
              <span>作品</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border-2 border-[#C4623A] bg-[#FAFAF7]" />
              <span>碰撞</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border border-[#555] bg-[repeating-linear-gradient(45deg,#aaa,#aaa_1px,transparent_1px,transparent_3px)]" />
              <span>障碍物</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4 bg-[#C4623A]" style={{ borderStyle: 'dashed' }} />
              <span>视线高度</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Move size={12} />
              <span>拖拽画框调整位置</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="sticky top-20 space-y-4">
          <div className="rounded-lg border border-[#D4CFC4]/60 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[#2C2C2C]">
              <Info size={14} />
              作品信息
            </h3>
            {selectedArtwork ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-[#2C2C2C]/40">名称</div>
                  <div className="text-sm font-medium text-[#2C2C2C]">
                    {selectedArtwork.name}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[#2C2C2C]/40">宽度</div>
                    <div className="text-sm font-mono text-[#2C2C2C]">
                      {selectedArtwork.frameWidth} cm
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#2C2C2C]/40">高度</div>
                    <div className="text-sm font-mono text-[#2C2C2C]">
                      {selectedArtwork.frameHeight} cm
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[#2C2C2C]/40">位置 X</div>
                    <div className="text-sm font-mono text-[#2C2C2C]">
                      {selectedArtwork.posX} cm
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#2C2C2C]/40">位置 Y</div>
                    <div className="text-sm font-mono text-[#2C2C2C]">
                      {selectedArtwork.posY} cm
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[#2C2C2C]/40">中心高度</div>
                    <div className="text-sm font-mono text-[#2C2C2C]">
                      {selectedArtwork.centerHeight} cm
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#2C2C2C]/40">视线偏差</div>
                    <div
                      className={`text-sm font-mono ${
                        Math.abs(selectedArtwork.sightLineDeviation) > 20
                          ? 'text-[#C4623A]'
                          : 'text-[#2C2C2C]'
                      }`}
                    >
                      {selectedArtwork.sightLineDeviation > 0 ? '+' : ''}
                      {selectedArtwork.sightLineDeviation} cm
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#2C2C2C]/40">展线顺序</div>
                  <div className="text-sm text-[#2C2C2C]">#{selectedArtwork.orderIndex}</div>
                </div>
                <div>
                  <div className="text-xs text-[#2C2C2C]/40">碰撞状态</div>
                  <div>
                    {selectedArtwork.hasCollision ? (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        碰撞
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        正常
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-[#2C2C2C]/30">
                点击画框查看详情
              </div>
            )}
          </div>

          {collisionArtworks.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-[#C4623A]">
                碰撞警告 ({collisionArtworks.length})
              </h3>
              <div className="space-y-1.5">
                {collisionArtworks.map((a) => (
                  <div key={a.id} className="text-xs text-[#2C2C2C]/70">
                    <span className="font-medium text-[#2C2C2C]">{a.name}</span> 与
                    <span className="font-medium">
                      {' '}
                      {a.collisionWith
                        .map((cid) => {
                          const art = artworks.find((x) => x.id === cid);
                          if (art) return art.name;
                          const obs = obstacles.find((o) => `obstacle:${o.id}` === cid);
                          if (obs) return obs.name;
                          return cid;
                        })
                        .join('、')}
                    </span>{' '}
                    重叠
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ObstacleNode({
  obstacle,
  toSvgX,
  toSvgY,
}: {
  obstacle: Obstacle;
  toSvgX: (cm: number) => number;
  toSvgY: (cm: number) => number;
}) {
  const patternId = `hatch-obs-${obstacle.id}`;
  return (
    <g>
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={8}
          height={8}
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke="#888" strokeWidth={1} />
        </pattern>
      </defs>
      <rect
        x={toSvgX(obstacle.posX)}
        y={toSvgY(obstacle.posY + obstacle.height)}
        width={obstacle.width}
        height={obstacle.height}
        fill={`url(#${patternId})`}
        fillOpacity={0.5}
        stroke="#555"
        strokeWidth={1}
      />
      <text
        x={toSvgX(obstacle.posX) + obstacle.width / 2}
        y={toSvgY(obstacle.posY + obstacle.height / 2) + 3}
        fill="#333"
        fontSize={10}
        fontFamily="sans-serif"
        textAnchor="middle"
        fontWeight={500}
      >
        {obstacle.name}
      </text>
      <text
        x={toSvgX(obstacle.posX) + obstacle.width / 2}
        y={toSvgY(obstacle.posY) - 3}
        fill="#666"
        fontSize={8}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {obstacle.width}×{obstacle.height}
      </text>
    </g>
  );
}

function ArtworkNode({
  artwork,
  toSvgX,
  toSvgY,
  isSelected,
  isDragging,
  onMouseDown,
}: {
  artwork: Artwork;
  toSvgX: (cm: number) => number;
  toSvgY: (cm: number) => number;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent, artwork: Artwork) => void;
}) {
  const x = toSvgX(artwork.posX);
  const y = toSvgY(artwork.posY + artwork.frameHeight);
  const w = artwork.frameWidth;
  const h = artwork.frameHeight;

  const strokeColor = artwork.hasCollision ? '#C4623A' : '#2C2C2C';
  const strokeWidth = isSelected ? 2.5 : artwork.hasCollision ? 2 : 1;

  return (
    <g
      onMouseDown={(e) => onMouseDown(e, artwork)}
      className="cursor-move"
      style={{ opacity: isDragging ? 0.7 : 1 }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#FAFAF7"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rx={2}
      />

      {isSelected && (
        <>
          <rect
            x={x - 3}
            y={y - 3}
            width={w + 6}
            height={h + 6}
            fill="none"
            stroke="#C4623A"
            strokeWidth={1}
            strokeDasharray="3,2"
            rx={3}
          />
          {[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([cx, cy], i) => (
            <rect
              key={i}
              x={cx - 3}
              y={cy - 3}
              width={6}
              height={6}
              fill="white"
              stroke="#C4623A"
              strokeWidth={1}
            />
          ))}
        </>
      )}

      {artwork.hasCollision && !isSelected && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke="#C4623A"
          strokeWidth={2}
          strokeDasharray="none"
          rx={2}
          className="animate-pulse"
        />
      )}

      <text
        x={x + w / 2}
        y={y + h / 2}
        fill="#2C2C2C"
        fontSize={Math.min(12, Math.max(8, h / 6))}
        fontFamily="sans-serif"
        textAnchor="middle"
        dominantBaseline="middle"
        fontWeight={500}
      >
        {artwork.name}
      </text>

      <text
        x={x + 3}
        y={y - 4}
        fill="#666"
        fontSize={8}
        fontFamily="monospace"
      >
        ({artwork.posX},{artwork.posY})
      </text>

      <line
        x1={x + w / 2}
        y1={y}
        x2={x + w / 2}
        y2={y + h}
        stroke="#2C2C2C"
        strokeWidth={0.3}
        strokeDasharray="1,2"
        opacity={0.3}
      />
      <circle cx={x + w / 2} cy={y + h / 2} r={2} fill="#C4623A" opacity={0.5} />
    </g>
  );
}
