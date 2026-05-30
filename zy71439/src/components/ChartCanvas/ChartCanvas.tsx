import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Lighthouse,
  BearingData,
  PositionMark,
  TriangleData,
  IntersectionPoint,
  GeoPoint,
  RouteOption
} from '../../types';
import {
  drawChartBackground,
  drawGrid,
  drawLighthouse,
  drawDepthMarkers,
  createCoordinateConverter,
  CanvasBounds
} from './LighthouseRenderer';
import {
  drawBearingLine,
  drawIntersectionPoints,
  drawErrorTriangle,
  drawRescueRoute
} from './BearingLineRenderer';
import {
  drawPositionMark,
  drawEstimatedPosition,
  drawTruePosition,
  drawMagneticAttraction
} from './PositionMarker';
import { useCanvasDrag } from '../../hooks/useCanvasDrag';

interface ChartCanvasProps {
  lighthouses: Lighthouse[];
  bearings: Record<string, BearingData>;
  positionMark: PositionMark | null;
  estimatedPosition: GeoPoint | null;
  truePosition?: GeoPoint;
  showTruePosition?: boolean;
  triangle: TriangleData | null;
  intersections: IntersectionPoint[];
  routeOptions: RouteOption[];
  selectedRouteId: string | null;
  bounds: CanvasBounds;
  onPositionMarkChange?: (position: GeoPoint) => void;
  onPositionMarkEnd?: (position: GeoPoint) => void;
  readonly?: boolean;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  lighthouses,
  bearings,
  positionMark,
  estimatedPosition,
  truePosition,
  showTruePosition = false,
  triangle,
  intersections,
  routeOptions,
  selectedRouteId,
  bounds,
  onPositionMarkChange,
  onPositionMarkEnd,
  readonly = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [animationProgress, setAnimationProgress] = useState<Record<string, number>>({});

  const converter = useMemo(() => {
    if (!canvasRef.current) return null;
    return createCoordinateConverter(canvasRef.current, bounds);
  }, [bounds]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.floor(width),
          height: Math.floor(height || 600)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const bearingIds = Object.keys(bearings);
    bearingIds.forEach(id => {
      if (!animationProgress[id]) {
        setAnimationProgress(prev => ({ ...prev, [id]: 0 }));
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / 800, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setAnimationProgress(prev => ({ ...prev, [id]: eased }));
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        requestAnimationFrame(animate);
      }
    });
  }, [bearings, animationProgress]);

  const handleDragMove = useCallback((position: GeoPoint) => {
    onPositionMarkChange?.(position);
  }, [onPositionMarkChange]);

  const handleDragEnd = useCallback((position: GeoPoint) => {
    onPositionMarkEnd?.(position);
  }, [onPositionMarkEnd]);

  const canvasDrag = useCanvasDrag(
    canvasRef,
    converter || { canvasToGeo: () => ({ lat: 0, lng: 0 }), geoToCanvas: () => ({ x: 0, y: 0 }) },
    readonly ? undefined : handleDragEnd,
    readonly ? undefined : handleDragMove
  );

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly || !converter) return;
    if (positionMark) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const position = converter.canvasToGeo(x, y);
    onPositionMarkEnd?.(position);
  }, [readonly, converter, positionMark, onPositionMarkEnd]);

  const magneticStrength = useMemo(() => {
    if (!positionMark || !estimatedPosition || !converter) return 0;
    const markPos = converter.geoToCanvas(positionMark.position);
    const estPos = converter.geoToCanvas(estimatedPosition);
    const distance = Math.sqrt(
      Math.pow(markPos.x - estPos.x, 2) +
      Math.pow(markPos.y - estPos.y, 2)
    );
    const maxDistance = 100;
    return Math.max(0, 1 - distance / maxDistance);
  }, [positionMark, estimatedPosition, converter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    drawChartBackground(ctx, width, height);
    drawGrid(ctx, width, height, bounds);
    drawDepthMarkers(ctx, width, height, bounds);

    if (truePosition) {
      drawTruePosition(ctx, truePosition, width, height, bounds, showTruePosition);
    }

    routeOptions.forEach(route => {
      drawRescueRoute(
        ctx,
        route,
        route.id === selectedRouteId,
        width,
        height,
        bounds
      );
    });

    lighthouses.forEach(lighthouse => {
      const pos = converter?.geoToCanvas(lighthouse.position) || { x: 0, y: 0 };
      const bearing = bearings[lighthouse.id];
      const isSelected = !!bearing;

      drawLighthouse(ctx, lighthouse, pos, isSelected);

      if (bearing) {
        const progress = animationProgress[lighthouse.id] || 1;
        drawBearingLine(
          ctx,
          lighthouse,
          bearing,
          width,
          height,
          bounds,
          true,
          progress
        );
      }
    });

    if (intersections.length > 0) {
      drawIntersectionPoints(ctx, intersections, width, height, bounds);
    }

    if (triangle) {
      drawErrorTriangle(ctx, triangle, width, height, bounds);
    }

    if (estimatedPosition) {
      drawEstimatedPosition(ctx, estimatedPosition, width, height, bounds);
    }

    if (positionMark) {
      drawPositionMark(
        ctx,
        positionMark,
        canvasDrag.dragState.isDragging,
        width,
        height,
        bounds
      );

      if (canvasDrag.dragState.isDragging && canvasDrag.dragState.dragCurrent && estimatedPosition && converter) {
        const estPos = converter.geoToCanvas(estimatedPosition);
        drawMagneticAttraction(
          ctx,
          estPos,
          canvasDrag.dragState.dragCurrent,
          magneticStrength
        );
      }
    }
  }, [
    dimensions,
    bounds,
    lighthouses,
    bearings,
    positionMark,
    estimatedPosition,
    truePosition,
    showTruePosition,
    triangle,
    intersections,
    routeOptions,
    selectedRouteId,
    converter,
    animationProgress,
    canvasDrag.dragState,
    magneticStrength
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl"
      style={{ background: '#0A2463' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.width, height: dimensions.height }}
        onClick={handleCanvasClick}
        onMouseDown={readonly ? undefined : canvasDrag.handleMouseDown}
        onMouseMove={readonly ? undefined : canvasDrag.handleMouseMove}
        onMouseUp={readonly ? undefined : canvasDrag.handleMouseUp}
        onMouseLeave={readonly ? undefined : canvasDrag.handleMouseLeave}
        onTouchStart={readonly ? undefined : canvasDrag.handleTouchStart}
        onTouchMove={readonly ? undefined : canvasDrag.handleTouchMove}
        onTouchEnd={readonly ? undefined : canvasDrag.handleTouchEnd}
        className={`${readonly ? 'cursor-default' : positionMark ? 'cursor-move' : 'cursor-crosshair'}`}
      />

      {!positionMark && !readonly && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm border border-slate-600">
          点击海图标注遇险船位置，或拖拽调整
        </div>
      )}

      {canvasDrag.dragState.isDragging && converter && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm border border-slate-600">
          {magneticStrength > 0.3 && (
            <span className="text-green-400 mr-2">🧲 磁力吸附</span>
          )}
          拖拽中... 释放确认位置
        </div>
      )}

      <div className="absolute top-4 right-4 bg-slate-900/70 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
        <div className="text-xs text-slate-300 font-semibold mb-2">图例</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-300">用户标注位置</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-green-500"></div>
            <span className="text-slate-300">算法估算位置</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-slate-300">方位线交点</span>
          </div>
          {showTruePosition && (
            <div className="flex items-center gap-2">
              <div className="text-purple-400">★</div>
              <span className="text-slate-300">真实位置</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartCanvas;
