import { BearingData, Lighthouse, GeoPoint, TriangleData, IntersectionPoint, RouteOption } from '../../types';
import { getBearingDecimal } from '../../utils/triangulation';
import { pointAlongBearing } from '../../utils/geoCalculations';

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

export function drawBearingLine(
  ctx: CanvasRenderingContext2D,
  lighthouse: Lighthouse,
  bearing: BearingData,
  width: number,
  height: number,
  bounds: CanvasBounds,
  animated: boolean = false,
  animationProgress: number = 1
) {
  const { geoToCanvas } = createConverter(width, height, bounds);
  const bearingDecimal = getBearingDecimal(bearing);
  const startPos = geoToCanvas(lighthouse.position);

  const maxDistance = 50000;
  const endPoint = pointAlongBearing(lighthouse.position, bearingDecimal, maxDistance);
  const endPos = geoToCanvas(endPoint);

  const targetX = startPos.x + (endPos.x - startPos.x) * animationProgress;
  const targetY = startPos.y + (endPos.y - startPos.y) * animationProgress;

  ctx.save();

  if (bearing.hasUnitError) {
    ctx.strokeStyle = '#F76C5E';
    ctx.setLineDash([8, 4]);
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = lighthouse.color;
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
  }

  ctx.shadowColor = lighthouse.color;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(startPos.x, startPos.y);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  const dashEndX = targetX + (endPos.x - startPos.x) * 0.3;
  const dashEndY = targetY + (endPos.y - startPos.y) * 0.3;
  ctx.setLineDash([4, 8]);
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(dashEndX, dashEndY);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  const angle = Math.atan2(targetY - startPos.y, targetX - startPos.x);
  const arrowLength = 12;
  ctx.fillStyle = bearing.hasUnitError ? '#F76C5E' : lighthouse.color;
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(
    targetX - arrowLength * Math.cos(angle - Math.PI / 6),
    targetY - arrowLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    targetX - arrowLength * Math.cos(angle + Math.PI / 6),
    targetY - arrowLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  const midX = (startPos.x + targetX) / 2;
  const midY = (startPos.y + targetY) / 2;
  ctx.fillStyle = bearing.hasUnitError ? '#F76C5E' : lighthouse.color;
  ctx.font = 'bold 12px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const bearingText = bearing.unit === 'dms'
    ? `${bearing.degrees}°${bearing.minutes}'${bearing.seconds.toFixed(0)}"`
    : `${bearing.decimalDegrees.toFixed(2)}°`;

  const perpAngle = angle + Math.PI / 2;
  const offsetX = Math.cos(perpAngle) * 15;
  const offsetY = Math.sin(perpAngle) * 15;

  ctx.fillText(bearingText, midX + offsetX, midY + offsetY);

  if (bearing.hasUnitError) {
    ctx.fillStyle = '#F76C5E';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('⚠️ 单位可能有误', midX + offsetX, midY + offsetY + 14);
  }

  ctx.restore();
}

export function drawIntersectionPoints(
  ctx: CanvasRenderingContext2D,
  intersections: IntersectionPoint[],
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createConverter(width, height, bounds);

  intersections.forEach((intersection, index) => {
    const pos = geoToCanvas(intersection.position);

    ctx.save();
    ctx.fillStyle = '#F9C80E';
    ctx.shadowColor = '#F9C80E';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}`, pos.x, pos.y);

    ctx.restore();
  });
}

export function drawErrorTriangle(
  ctx: CanvasRenderingContext2D,
  triangle: TriangleData,
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createConverter(width, height, bounds);

  const points = triangle.vertices.map(v => geoToCanvas(v));

  ctx.save();

  const fillColor = triangle.errorLevel === 'excellent'
    ? 'rgba(68, 175, 105, 0.2)'
    : triangle.errorLevel === 'good'
      ? 'rgba(249, 200, 14, 0.2)'
      : triangle.errorLevel === 'fair'
        ? 'rgba(247, 108, 94, 0.2)'
        : 'rgba(231, 76, 60, 0.3)';

  const strokeColor = triangle.errorLevel === 'excellent'
    ? '#44AF69'
    : triangle.errorLevel === 'good'
      ? '#F9C80E'
      : triangle.errorLevel === 'fair'
        ? '#F76C5E'
        : '#E74C3C';

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const centroidPos = geoToCanvas(triangle.centroid);
  ctx.setLineDash([]);
  ctx.fillStyle = strokeColor;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.arc(centroidPos.x, centroidPos.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×', centroidPos.x, centroidPos.y);

  ctx.restore();
}

export function drawRescueRoute(
  ctx: CanvasRenderingContext2D,
  route: RouteOption,
  isSelected: boolean,
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createConverter(width, height, bounds);

  const points = [route.start, ...route.waypoints, route.end];
  const canvasPoints = points.map(p => geoToCanvas(p));

  ctx.save();

  if (isSelected) {
    ctx.strokeStyle = '#44AF69';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#44AF69';
    ctx.shadowBlur = 15;
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
  }

  ctx.beginPath();
  ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  canvasPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.stroke();

  const startPos = canvasPoints[0];
  ctx.fillStyle = isSelected ? '#44AF69' : 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(startPos.x, startPos.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚓', startPos.x, startPos.y);

  const endPos = canvasPoints[canvasPoints.length - 1];
  ctx.fillStyle = isSelected ? '#E74C3C' : 'rgba(231, 76, 60, 0.6)';
  ctx.beginPath();
  ctx.arc(endPos.x, endPos.y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText('🚢', endPos.x, endPos.y);

  ctx.restore();
}
