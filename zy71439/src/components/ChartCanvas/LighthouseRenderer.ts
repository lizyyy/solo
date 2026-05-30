import { Lighthouse, GeoPoint } from '../../types';

export interface CanvasBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function createCoordinateConverter(
  canvas: HTMLCanvasElement,
  bounds: CanvasBounds
) {
  const width = canvas.width;
  const height = canvas.height;
  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;

  function geoToCanvas(point: GeoPoint): { x: number; y: number } {
    const x = ((point.lng - bounds.minLng) / lngRange) * width;
    const y = height - ((point.lat - bounds.minLat) / latRange) * height;
    return { x, y };
  }

  function canvasToGeo(x: number, y: number): GeoPoint {
    const lng = (x / width) * lngRange + bounds.minLng;
    const lat = ((height - y) / height) * latRange + bounds.minLat;
    return { lat, lng };
  }

  return { geoToCanvas, canvasToGeo };
}

export function drawChartBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a365d');
  gradient.addColorStop(0.5, '#2c5282');
  gradient.addColorStop(1, '#1a365d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillRect(x, y, 1, 1);
  }

  const vignetteGradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  vignetteGradient.addColorStop(0, 'transparent');
  vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createCoordinateConverter(
    { width, height } as HTMLCanvasElement,
    bounds
  );

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  const latStep = 0.005;
  const lngStep = 0.005;

  for (let lat = Math.ceil(bounds.minLat / latStep) * latStep; lat <= bounds.maxLat; lat += latStep) {
    const { y } = geoToCanvas({ lat, lng: bounds.minLng });
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${lat.toFixed(3)}°`, 5, y - 3);
  }

  for (let lng = Math.ceil(bounds.minLng / lngStep) * lngStep; lng <= bounds.maxLng; lng += lngStep) {
    const { x } = geoToCanvas({ lat: bounds.minLat, lng });
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${lng.toFixed(3)}°`, x, height - 5);
  }
}

export function drawLighthouse(
  ctx: CanvasRenderingContext2D,
  lighthouse: Lighthouse,
  position: { x: number; y: number },
  isSelected: boolean = false
) {
  const radius = isSelected ? 14 : 12;

  ctx.shadowColor = lighthouse.color;
  ctx.shadowBlur = isSelected ? 20 : 10;

  ctx.fillStyle = lighthouse.color;
  ctx.beginPath();
  ctx.moveTo(position.x, position.y - radius);
  ctx.lineTo(position.x + radius * 0.7, position.y + radius * 0.5);
  ctx.lineTo(position.x - radius * 0.7, position.y + radius * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(position.x, position.y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Playfair Display, serif';
  ctx.textAlign = 'center';
  ctx.fillText(lighthouse.name, position.x, position.y + radius + 14);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText(
    `${lighthouse.position.lat.toFixed(3)}°N, ${lighthouse.position.lng.toFixed(3)}°E`,
    position.x,
    position.y + radius + 26
  );
}

export function drawDepthMarkers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: CanvasBounds
) {
  const { geoToCanvas } = createCoordinateConverter(
    { width, height } as HTMLCanvasElement,
    bounds
  );

  const depths = [
    { lat: bounds.minLat + (bounds.maxLat - bounds.minLat) * 0.3, lng: bounds.minLng + (bounds.maxLng - bounds.minLng) * 0.2, depth: 15 },
    { lat: bounds.minLat + (bounds.maxLat - bounds.minLat) * 0.6, lng: bounds.minLng + (bounds.maxLng - bounds.minLng) * 0.7, depth: 28 },
    { lat: bounds.minLat + (bounds.maxLat - bounds.minLat) * 0.8, lng: bounds.minLng + (bounds.maxLng - bounds.minLng) * 0.4, depth: 12 },
  ];

  depths.forEach(d => {
    const { x, y } = geoToCanvas({ lat: d.lat, lng: d.lng });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${d.depth}m`, x, y);
  });
}
