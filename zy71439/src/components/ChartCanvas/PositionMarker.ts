import { GeoPoint, PositionMark } from '../../types';

export interface CanvasBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function createConverter(
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;

  function geoToCanvas(point: GeoPoint): { x: number; y: number } {
    const x = ((point.lng - bounds.minLng) / lngRange) * width;
    const y = height - ((point.lat - bounds.minLat) / latRange) * height;
    return { x, y };
  }

  return { geoToCanvas };
}

export function drawPositionMark(
  ctx: CanvasRenderingContext2D,
  mark: PositionMark,
  isDragging: boolean,
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createConverter(width, height, bounds);
  const pos = geoToCanvas(mark.position);

  ctx.save();

  const radius = isDragging ? 18 : 14;

  ctx.strokeStyle = '#F76C5E';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius + 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(247, 108, 94, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 8 + i * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = isDragging ? '#E74C3C' : '#F76C5E';
  ctx.shadowColor = '#F76C5E';
  ctx.shadowBlur = isDragging ? 25 : 15;

  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - radius);
  ctx.bezierCurveTo(
    pos.x + radius, pos.y - radius,
    pos.x + radius, pos.y + radius * 0.3,
    pos.x, pos.y + radius
  );
  ctx.bezierCurveTo(
    pos.x - radius, pos.y + radius * 0.3,
    pos.x - radius, pos.y - radius,
    pos.x, pos.y - radius
  );
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - radius * 0.2, radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pos.x - radius * 0.4, pos.y - radius * 0.2);
  ctx.lineTo(pos.x + radius * 0.4, pos.y - radius * 0.2);
  ctx.moveTo(pos.x, pos.y - radius * 0.55);
  ctx.lineTo(pos.x, pos.y + radius * 0.15);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${mark.position.lat.toFixed(4)}°N`,
    pos.x,
    pos.y + radius + 16
  );
  ctx.fillText(
    `${mark.position.lng.toFixed(4)}°E`,
    pos.x,
    pos.y + radius + 30
  );

  if (mark.confidence) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px sans-serif';
    ctx.fillText(
      `置信度 ${(mark.confidence * 100).toFixed(0)}%`,
      pos.x,
      pos.y + radius + 44
    );
  }

  ctx.restore();
}

export function drawEstimatedPosition(
  ctx: CanvasRenderingContext2D,
  position: GeoPoint,
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createConverter(width, height, bounds);
  const pos = geoToCanvas(position);

  ctx.save();

  ctx.strokeStyle = '#44AF69';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#44AF69';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pos.x - 14, pos.y);
  ctx.lineTo(pos.x + 14, pos.y);
  ctx.moveTo(pos.x, pos.y - 14);
  ctx.lineTo(pos.x, pos.y + 14);
  ctx.stroke();

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#44AF69';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('算法估算位置', pos.x, pos.y + 24);

  ctx.restore();
}

export function drawTruePosition(
  ctx: CanvasRenderingContext2D,
  position: GeoPoint,
  width: number,
  height: number,
  bounds: CanvasBounds,
  visible: boolean = false
) {
  if (!visible) return;

  const { geoToCanvas } = createConverter(width, height, bounds);
  const pos = geoToCanvas(position);

  ctx.save();

  ctx.fillStyle = '#9B59B6';
  ctx.shadowColor = '#9B59B6';
  ctx.shadowBlur = 15;

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 14 : 6;
    const x = pos.x + r * Math.cos(angle);
    const y = pos.y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ 真实位置', pos.x, pos.y + 26);

  ctx.restore();
}

export function drawMagneticAttraction(
  ctx: CanvasRenderingContext2D,
  targetPos: { x: number; y: number },
  dragPos: { x: number; y: number },
  strength: number
) {
  if (strength <= 0) return;

  ctx.save();

  ctx.strokeStyle = `rgba(247, 108, 94, ${strength * 0.5})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  ctx.beginPath();
  ctx.moveTo(targetPos.x, targetPos.y);
  ctx.lineTo(dragPos.x, dragPos.y);
  ctx.stroke();

  const angle = Math.atan2(dragPos.y - targetPos.y, dragPos.x - targetPos.x);
  const arrowSize = 8 * strength;
  ctx.fillStyle = `rgba(247, 108, 94, ${strength * 0.8})`;
  ctx.beginPath();
  ctx.moveTo(dragPos.x, dragPos.y);
  ctx.lineTo(
    dragPos.x - arrowSize * Math.cos(angle - Math.PI / 6),
    dragPos.y - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    dragPos.x - arrowSize * Math.cos(angle + Math.PI / 6),
    dragPos.y - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
