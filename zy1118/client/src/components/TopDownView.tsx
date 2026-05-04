import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Plan, Booth, ValidationResult, Position } from '../types';
import { 
  getBoothRect, 
  snapPositionToGrid, 
  boothColors, 
  riskLevelColors,
  doRectanglesOverlap
} from '../utils/geometry';

interface TopDownViewProps {
  plan: Plan | null;
  validationResults: ValidationResult[];
  selectedBoothId: string | null;
  onSelectBooth: (id: string | null) => void;
  onMoveBooth: (id: string, newPosition: Position) => void;
  showGrid?: boolean;
}

export function TopDownView({ 
  plan, 
  validationResults,
  selectedBoothId, 
  onSelectBooth,
  onMoveBooth,
  showGrid = true 
}: TopDownViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPreview, setDragPreview] = useState<Position | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredBoothId, setHoveredBoothId] = useState<string | null>(null);

  const padding = 30;
  const minScale = 0.5;
  const maxScale = 3;

  const riskLocations = useMemo(() => {
    return validationResults
      .filter(r => !r.passed && r.location)
      .map(r => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        riskLevel: r.riskLevel,
        location: r.location!,
        message: r.message
      }));
  }, [validationResults]);

  const getRiskForBooth = useCallback((boothId: string) => {
    return validationResults.find(r => 
      !r.passed && 
      r.affectedObjects?.some(o => o.id === boothId && o.type === 'booth')
    );
  }, [validationResults]);

  const screenToWorld = useCallback((screenX: number, screenY: number): Position => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const worldX = (screenX - cx - pan.x) / scale;
    const worldY = (screenY - cy - pan.y) / scale;

    return { x: worldX, y: worldY };
  }, [plan, scale, pan]);

  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const screenX = worldX * scale + cx + pan.x;
    const screenY = worldY * scale + cy + pan.y;

    return { x: screenX, y: screenY };
  }, [scale, pan]);

  const getBoothAtPosition = useCallback((worldX: number, worldY: number): Booth | null => {
    if (!plan) return null;

    for (let i = plan.booths.length - 1; i >= 0; i--) {
      const booth = plan.booths[i];
      const rect = getBoothRect(booth.position, booth.size);
      if (worldX >= rect.x && worldX <= rect.x + rect.width &&
          worldY >= rect.y && worldY <= rect.y + rect.height) {
        return booth;
      }
    }
    return null;
  }, [plan]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(scale, scale);

    const hallWidth = plan.hall.dimensions.width;
    const hallDepth = plan.hall.dimensions.depth;
    const gridSize = plan.hall.gridSize || 1;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2 / scale;
    ctx.fillRect(0, 0, hallWidth, hallDepth);
    ctx.strokeRect(0, 0, hallWidth, hallDepth);

    if (showGrid) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.5 / scale;

      for (let x = 0; x <= hallWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, hallDepth);
        ctx.stroke();
      }

      for (let y = 0; y <= hallDepth; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(hallWidth, y);
        ctx.stroke();
      }
    }

    for (const entrance of plan.hall.entrances) {
      ctx.fillStyle = entrance.isMain ? '#10b981' : '#34d399';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 1 / scale;
      ctx.fillRect(
        entrance.position.x,
        entrance.position.y,
        entrance.size.width,
        entrance.size.depth
      );
      ctx.strokeRect(
        entrance.position.x,
        entrance.position.y,
        entrance.size.width,
        entrance.size.depth
      );

      ctx.fillStyle = '#ffffff';
      ctx.font = `${10 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        entrance.isMain ? '主入口' : '入口',
        entrance.position.x + entrance.size.width / 2,
        entrance.position.y + entrance.size.depth / 2 + 3 / scale
      );
    }

    for (const exit of plan.hall.exits) {
      ctx.fillStyle = exit.isEmergency ? '#ef4444' : '#f97316';
      ctx.strokeStyle = exit.isEmergency ? '#dc2626' : '#ea580c';
      ctx.lineWidth = 1 / scale;
      ctx.fillRect(
        exit.position.x,
        exit.position.y,
        exit.size.width,
        exit.size.depth
      );
      ctx.strokeRect(
        exit.position.x,
        exit.position.y,
        exit.size.width,
        exit.size.depth
      );

      ctx.fillStyle = '#ffffff';
      ctx.font = `${10 / scale}px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        exit.isEmergency ? '消防出口' : '出口',
        exit.position.x + exit.size.width / 2,
        exit.position.y + exit.size.depth / 2 + 3 / scale
      );
    }

    for (const pillar of plan.hall.pillars) {
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1 / scale;
      ctx.fillRect(
        pillar.position.x,
        pillar.position.y,
        pillar.size.width,
        pillar.size.depth
      );
      ctx.strokeRect(
        pillar.position.x,
        pillar.position.y,
        pillar.size.width,
        pillar.size.depth
      );
    }

    for (const zone of plan.powerZones) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([5 / scale, 3 / scale]);
      ctx.fillRect(
        zone.position.x,
        zone.position.y,
        zone.size.width,
        zone.size.depth
      );
      ctx.strokeRect(
        zone.position.x,
        zone.position.y,
        zone.size.width,
        zone.size.depth
      );
      ctx.setLineDash([]);

      ctx.fillStyle = '#92400e';
      ctx.font = `${9 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        zone.name,
        zone.position.x + zone.size.width / 2,
        zone.position.y + 15 / scale
      );
    }

    for (const risk of riskLocations) {
      const color = riskLevelColors[risk.riskLevel] || riskLevelColors.critical;
      const size = risk.riskLevel === 'critical' ? 1.2 : risk.riskLevel === 'high' ? 1 : 0.8;

      ctx.fillStyle = color + '60';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / scale;

      ctx.beginPath();
      ctx.arc(risk.location.x, risk.location.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `bold ${12 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('!', risk.location.x, risk.location.y + 4 / scale);
    }

    for (const booth of plan.booths) {
      const isSelected = booth.id === selectedBoothId;
      const isHovered = booth.id === hoveredBoothId;
      const isDragging = isDragging && selectedBoothId === booth.id;
      const risk = getRiskForBooth(booth.id);

      let displayPosition = booth.position;
      if (isDragging && dragPreview) {
        displayPosition = dragPreview;
      }

      const color = boothColors[booth.type] || boothColors.other;
      const alpha = isDragging ? 0.6 : 1;

      if (risk) {
        const riskColor = riskLevelColors[risk.riskLevel] || riskLevelColors.critical;
        ctx.fillStyle = riskColor + '40';
        ctx.strokeStyle = riskColor;
        ctx.lineWidth = 3 / scale;
        ctx.fillRect(
          displayPosition.x - 0.2,
          displayPosition.y - 0.2,
          booth.size.width + 0.4,
          booth.size.depth + 0.4
        );
        ctx.strokeRect(
          displayPosition.x - 0.2,
          displayPosition.y - 0.2,
          booth.size.width + 0.4,
          booth.size.depth + 0.4
        );
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(
        displayPosition.x,
        displayPosition.y,
        booth.size.width,
        booth.size.depth
      );

      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? '#2563eb' : '#60a5fa';
        ctx.lineWidth = isSelected ? 3 / scale : 2 / scale;
        ctx.strokeRect(
          displayPosition.x,
          displayPosition.y,
          booth.size.width,
          booth.size.depth
        );
      } else {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1 / scale;
        ctx.strokeRect(
          displayPosition.x,
          displayPosition.y,
          booth.size.width,
          booth.size.depth
        );
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${10 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        booth.name,
        displayPosition.x + booth.size.width / 2,
        displayPosition.y + booth.size.depth / 2 + 3 / scale
      );

      if (booth.isPopular) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${12 / scale}px sans-serif`;
        ctx.fillText(
          '★',
          displayPosition.x + booth.size.width - 0.5,
          displayPosition.y + 1.2
        );
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [plan, scale, pan, showGrid, selectedBoothId, hoveredBoothId, isDragging, dragPreview, riskLocations, getRiskForBooth]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    e.preventDefault();

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: mouseX - pan.x, y: mouseY - pan.y });
      return;
    }

    const worldPos = screenToWorld(mouseX, mouseY);
    const booth = getBoothAtPosition(worldPos.x, worldPos.y);

    if (booth) {
      onSelectBooth(booth.id);
      setIsDragging(true);
      setDragOffset({
        x: worldPos.x - booth.position.x,
        y: worldPos.y - booth.position.y
      });
    } else {
      onSelectBooth(null);
    }
  }, [plan, pan, screenToWorld, getBoothAtPosition, onSelectBooth]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setPan({
        x: mouseX - panStart.x,
        y: mouseY - panStart.y
      });
      return;
    }

    const worldPos = screenToWorld(mouseX, mouseY);

    if (isDragging && selectedBoothId) {
      const booth = plan.booths.find(b => b.id === selectedBoothId);
      if (booth) {
        const newPos: Position = {
          x: worldPos.x - dragOffset.x,
          y: worldPos.y - dragOffset.y
        };
        
        const snappedPos = snapPositionToGrid(
          newPos,
          plan.hall.gridSize,
          booth.size,
          plan.hall.dimensions
        );
        
        setDragPreview(snappedPos);
      }
    } else {
      const booth = getBoothAtPosition(worldPos.x, worldPos.y);
      setHoveredBoothId(booth?.id || null);
    }
  }, [plan, isDragging, isPanning, selectedBoothId, dragOffset, panStart, screenToWorld, getBoothAtPosition]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && selectedBoothId && dragPreview && plan) {
      onMoveBooth(selectedBoothId, dragPreview);
    }
    setIsDragging(false);
    setIsPanning(false);
    setDragPreview(null);
  }, [isDragging, selectedBoothId, dragPreview, plan, onMoveBooth]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, minScale), maxScale));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        drawScene();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawScene]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  return (
    <div className="w-full h-full relative bg-slate-50">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
      />
      
      <div className="absolute bottom-4 left-4 flex gap-2">
        <button
          onClick={() => setScale(prev => Math.min(prev + 0.2, maxScale))}
          className="w-8 h-8 bg-white rounded shadow hover:bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600"
        >
          +
        </button>
        <button
          onClick={() => setScale(prev => Math.max(prev - 0.2, minScale))}
          className="w-8 h-8 bg-white rounded shadow hover:bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600"
        >
          -
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
          className="px-3 h-8 bg-white rounded shadow hover:bg-gray-100 flex items-center justify-center text-sm text-gray-600"
        >
          重置视图
        </button>
      </div>

      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-gray-500">
        <div>滚轮缩放 · 拖拽平移 · Alt+拖拽平移</div>
      </div>

      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-sm">
        <span className="text-gray-500">缩放:</span>
        <span className="ml-2 font-medium text-gray-700">{(scale * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
