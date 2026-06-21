import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { INSTRUMENT_COLORS, INSTRUMENT_GROUPS } from '@/data/mockData';
import { ANOMALY_LABELS, DATA_SOURCE_LABELS, STATUS_LABELS } from '@/types';
import type { SoundFieldPoint } from '@/types';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 550;
const PADDING = 60;

export function SceneVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { points, params, selectedPointId, selectPoint, getFilteredPoints } = useStore();
  const [hoveredPoint, setHoveredPoint] = useState<SoundFieldPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const filteredPoints = getFilteredPoints();

  const coordSystems = useMemo(
    () => [...new Set(points.map((p) => p.coordinateSystem))],
    [points]
  );
  const mainCoordSystem = params.coordinateSystem;

  const getCoordMismatchPointPos = useCallback(
    (point: SoundFieldPoint) => {
      const otherSystems = coordSystems.filter((s) => s !== mainCoordSystem);
      const systemIndex = otherSystems.indexOf(point.coordinateSystem);
      if (systemIndex === -1) return null;

      const zoneHeight = (CANVAS_HEIGHT - PADDING * 2) / (otherSystems.length + 1);
      const systemPoints = points.filter((p) => p.coordinateSystem === point.coordinateSystem);
      const pointIndexInSystem = systemPoints.findIndex((p) => p.id === point.id);
      const pointsPerRow = 5;
      const row = Math.floor(pointIndexInSystem / pointsPerRow);
      const col = pointIndexInSystem % pointsPerRow;

      return {
        drawY: PADDING + zoneHeight * (systemIndex + 1) + zoneHeight / 2 + row * 30,
        drawX: PADDING + 50 + col * 80,
      };
    },
    [coordSystems, mainCoordSystem, points]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const drawGrid = () => {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      for (let x = PADDING; x <= CANVAS_WIDTH - PADDING; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, PADDING);
        ctx.lineTo(x, CANVAS_HEIGHT - PADDING);
        ctx.stroke();
      }

      for (let y = PADDING; y <= CANVAS_HEIGHT - PADDING; y += 40) {
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(CANVAS_WIDTH - PADDING, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px Noto Sans SC';
      for (let x = PADDING; x <= CANVAS_WIDTH - PADDING; x += 80) {
        const coordX = Math.round(((x - PADDING) / (CANVAS_WIDTH - PADDING * 2)) * 500);
        ctx.fillText(`${coordX}`, x - 8, CANVAS_HEIGHT - PADDING + 18);
      }
      for (let y = PADDING; y <= CANVAS_HEIGHT - PADDING; y += 80) {
        const coordY = Math.round(((y - PADDING) / (CANVAS_HEIGHT - PADDING * 2)) * 600);
        ctx.fillText(`${coordY}`, PADDING - 28, y + 3);
      }

      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      ctx.strokeRect(PADDING, PADDING, CANVAS_WIDTH - PADDING * 2, CANVAS_HEIGHT - PADDING * 2);

      ctx.fillStyle = '#374151';
      ctx.font = '11px Noto Sans SC';
      ctx.fillText('X (m)', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15);
      ctx.save();
      ctx.translate(20, CANVAS_HEIGHT / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Y (m)', 0, 0);
      ctx.restore();
    };

    const drawCoordinateSystemZones = () => {
      const otherSystems = coordSystems.filter((s) => s !== mainCoordSystem);
      if (otherSystems.length === 0) return;

      const zoneHeight = (CANVAS_HEIGHT - PADDING * 2) / (otherSystems.length + 1);
      otherSystems.forEach((system, index) => {
        const y = PADDING + zoneHeight * (index + 1);
        
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(CANVAS_WIDTH - PADDING, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#7c3aed';
        ctx.font = 'bold 10px Noto Sans SC';
        ctx.fillText(
          `坐标系分区: ${system} (不硬画)`,
          PADDING + 10,
          y - 8
        );

        ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
        ctx.fillRect(PADDING + 5, y + 5, CANVAS_WIDTH - PADDING * 2 - 10, zoneHeight - 10);
      });
    };

    const drawGroupLabels = () => {
      const groups = Object.entries(INSTRUMENT_GROUPS);
      const groupY = [140, 240, 340, 440];
      
      groups.forEach(([groupName], index) => {
        const y = PADDING + groupY[index] - 80;
        ctx.fillStyle = '#1a365d';
        ctx.font = 'bold 12px Noto Serif SC';
        ctx.fillText(groupName, PADDING + 10, y);
        
        ctx.strokeStyle = '#1a365d';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PADDING + 80, y - 4);
        ctx.lineTo(CANVAS_WIDTH - PADDING - 10, y - 4);
        ctx.stroke();
      });
    };

    const drawPoints = () => {
      filteredPoints.forEach((point) => {
        const isCoordMismatch = point.coordinateSystem !== mainCoordSystem;
        let drawX = point.x + PADDING;
        let drawY = point.y + PADDING;

        if (isCoordMismatch) {
          const pos = getCoordMismatchPointPos(point);
          if (pos) {
            drawX = pos.drawX;
            drawY = pos.drawY;
          }
        }

        if (point.status === 'anomaly' || point.status === 'pending') {
          ctx.beginPath();
          ctx.arc(drawX, drawY, 18, 0, Math.PI * 2);
          ctx.fillStyle =
            point.status === 'anomaly'
              ? 'rgba(221, 107, 32, 0.3)'
              : 'rgba(214, 158, 46, 0.3)';
          ctx.fill();
        }

        const baseColor = INSTRUMENT_COLORS[point.instrument] || '#6b7280';
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, 14, 0, Math.PI * 2);
        
        if (point.dataSource === 'gis_legacy') {
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#8b5cf6';
        } else {
          ctx.setLineDash([]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
        }
        
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (selectedPointId === point.id) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, 22, 0, Math.PI * 2);
          ctx.strokeStyle = '#1a365d';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Noto Sans SC';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const shortName = point.name.split('-')[0].charAt(0);
        ctx.fillText(shortName, drawX, drawY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        if (point.anomalies.length > 0) {
          ctx.fillStyle = point.status === 'pending' ? '#d69e2e' : '#dd6b20';
          ctx.beginPath();
          ctx.arc(drawX + 10, drawY - 10, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', drawX + 10, drawY - 10);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }

        ctx.fillStyle = '#374151';
        ctx.font = '9px Noto Sans SC';
        const displayName = point.name.length > 6 
          ? point.name.substring(0, 6) + '...' 
          : point.name;
        ctx.fillText(displayName, drawX - 20, drawY + 25);

        if (isCoordMismatch) {
          ctx.fillStyle = '#7c3aed';
          ctx.font = '8px Noto Sans SC';
          ctx.fillText(`[${point.coordinateSystem}]`, drawX - 20, drawY + 38);
        }
      });
    };

    drawGrid();
    drawCoordinateSystemZones();
    drawGroupLabels();
    drawPoints();
  }, [filteredPoints, coordSystems, mainCoordSystem, selectedPointId, getCoordMismatchPointPos]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clickedPoint = filteredPoints.find((point) => {
      const isCoordMismatch = point.coordinateSystem !== mainCoordSystem;
      let drawX = point.x + PADDING;
      let drawY = point.y + PADDING;

      if (isCoordMismatch) {
        const pos = getCoordMismatchPointPos(point);
        if (pos) {
          drawX = pos.drawX;
          drawY = pos.drawY;
        }
      }

      const dist = Math.sqrt((x - drawX) ** 2 + (y - drawY) ** 2);
      return dist <= 20;
    });

    if (clickedPoint) {
      selectPoint(clickedPoint.id === selectedPointId ? null : clickedPoint.id);
    } else {
      selectPoint(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hovered = filteredPoints.find((point) => {
      const isCoordMismatch = point.coordinateSystem !== mainCoordSystem;
      let drawX = point.x + PADDING;
      let drawY = point.y + PADDING;

      if (isCoordMismatch) {
        const pos = getCoordMismatchPointPos(point);
        if (pos) {
          drawX = pos.drawX;
          drawY = pos.drawY;
        }
      }

      const dist = Math.sqrt((x - drawX) ** 2 + (y - drawY) ** 2);
      return dist <= 20;
    });

    setHoveredPoint(hovered || null);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const selectedPoint = points.find((p) => p.id === selectedPointId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-700 font-serif">
          交响乐团站位声场分布图
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            GIS旧口径
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            异常点位
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            待确认
          </span>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          className="w-full bg-white rounded-lg shadow-inner border border-gray-200 cursor-pointer"
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        {hoveredPoint && (
          <div
            className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none"
            style={{
              left: tooltipPos.x + 15,
              top: tooltipPos.y + 15,
              maxWidth: '280px',
            }}
          >
            <div className="font-bold mb-1">{hoveredPoint.name}</div>
            <div className="space-y-1 text-gray-300">
              <div>乐器: {hoveredPoint.instrument}</div>
              <div>坐标: ({hoveredPoint.x}, {hoveredPoint.y})</div>
              <div>坐标系: {hoveredPoint.coordinateSystem}</div>
              <div>楼层: {hoveredPoint.floor}层</div>
              <div>来源: {DATA_SOURCE_LABELS[hoveredPoint.dataSource]}</div>
              <div>状态: {STATUS_LABELS[hoveredPoint.status]}</div>
            </div>
            {hoveredPoint.anomalies.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-orange-400 font-medium">异常:</div>
                {hoveredPoint.anomalies.map((a) => (
                  <div key={a} className="text-orange-300">
                    • {ANOMALY_LABELS[a]}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPoint && (
        <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-primary-800 mb-2">
                {selectedPoint.name} - 判断过程
              </div>
              <p className="text-sm text-primary-700 leading-relaxed">
                {selectedPoint.judgmentProcess}
              </p>
              {selectedPoint.dataSource === 'gis_legacy' && (
                <div className="mt-2 text-xs text-purple-700 bg-purple-50 p-2 rounded">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  该数据来自GIS底图旧口径，请谨慎参考
                </div>
              )}
              {selectedPoint.anomalies.includes('coordinate_mismatch') && (
                <div className="mt-2 text-xs text-purple-700 bg-purple-50 p-2 rounded">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  坐标系不一致，已在下方分区显示，未硬画入主坐标系空间
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#e11d48' }}></div>
          <span>小提琴</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
          <span>中提琴</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
          <span>大提琴</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
          <span>低音提琴</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#06b6d4' }}></div>
          <span>长笛</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
          <span>双簧管</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8b5cf6' }}></div>
          <span>单簧管</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#a855f7' }}></div>
          <span>大管</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ec4899' }}></div>
          <span>圆号</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f43f5e' }}></div>
          <span>小号</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#14b8a6' }}></div>
          <span>长号</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6366f1' }}></div>
          <span>大号</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#78716c' }}></div>
          <span>打击乐</span>
        </div>
      </div>
    </div>
  );
}
