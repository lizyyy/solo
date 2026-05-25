import type { PlacedItem, BoxType, Commodity } from '../../types/game';
import { getCommodityById } from '../../data/commodities';
import { getCommodityAABB } from '../rules/collision';

export interface DrawOptions {
  showGrid: boolean;
  showLabels: boolean;
  highlightViolations: boolean;
  violationCommodityIds: string[];
  previewItem?: {
    commodity: Commodity;
    x: number;
    y: number;
    layer: number;
    rotation: number;
    isValid: boolean;
  };
}

export const drawBox = (
  ctx: CanvasRenderingContext2D,
  boxType: BoxType,
  offsetX: number,
  offsetY: number,
  pixelGridSize: number
) => {
  const boxWidth = boxType.width * pixelGridSize;
  const boxHeight = boxType.height * pixelGridSize;
  
  ctx.fillStyle = boxType.color;
  ctx.fillRect(offsetX, offsetY, boxWidth, boxHeight);
  
  ctx.strokeStyle = '#8B7355';
  ctx.lineWidth = 3;
  ctx.strokeRect(offsetX, offsetY, boxWidth, boxHeight);
  
  ctx.strokeStyle = '#C4A77D';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(offsetX + 5, offsetY + 5, boxWidth - 10, boxHeight - 10);
  ctx.setLineDash([]);
  
  for (let x = 0; x <= boxType.width; x++) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(offsetX + x * pixelGridSize, offsetY);
    ctx.lineTo(offsetX + x * pixelGridSize, offsetY + boxHeight);
    ctx.stroke();
  }
  
  for (let y = 0; y <= boxType.height; y++) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(offsetX, offsetY + y * pixelGridSize);
    ctx.lineTo(offsetX + boxWidth, offsetY + y * pixelGridSize);
    ctx.stroke();
  }
  
  ctx.fillStyle = '#8B7355';
  ctx.font = '10px monospace';
  for (let x = 0; x < boxType.width; x++) {
    ctx.fillText(x.toString(), offsetX + x * pixelGridSize + 3, offsetY + 12);
  }
  for (let y = 0; y < boxType.height; y++) {
    ctx.fillText(y.toString(), offsetX + 3, offsetY + y * pixelGridSize + 12);
  }
};

export const drawCommodity = (
  ctx: CanvasRenderingContext2D,
  item: PlacedItem,
  offsetX: number,
  offsetY: number,
  pixelGridSize: number,
  isViolation: boolean = false,
  opacity: number = 1
) => {
  const commodity = getCommodityById(item.commodityId);
  if (!commodity) return;
  
  const aabb = getCommodityAABB(item, commodity);
  const x = offsetX + aabb.x * pixelGridSize;
  const y = offsetY + aabb.y * pixelGridSize;
  const w = aabb.width * pixelGridSize;
  const h = aabb.height * pixelGridSize;
  
  ctx.save();
  ctx.globalAlpha = opacity;
  
  const layerOffset = item.layer * 4;
  const shadowOffset = 2 + item.layer * 2;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(
    x + shadowOffset,
    y + shadowOffset,
    w - 4,
    h - 4
  );
  
  ctx.fillStyle = commodity.color;
  ctx.fillRect(
    x + 2 + layerOffset,
    y + 2 - layerOffset,
    w - 4,
    h - 4
  );
  
  if (isViolation) {
    ctx.strokeStyle = '#F53F3F';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
  } else {
    ctx.strokeStyle = darkenColor(commodity.color, 0.3);
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  }
  ctx.strokeRect(
    x + 2 + layerOffset,
    y + 2 - layerOffset,
    w - 4,
    h - 4
  );
  ctx.setLineDash([]);
  
  drawCommodityBadges(ctx, commodity, x, y, w, h, layerOffset);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(commodity.name, x + w / 2 + layerOffset, y + h / 2 - layerOffset);
  
  if (item.layer > 0) {
    ctx.fillStyle = '#FF7D00';
    ctx.beginPath();
    ctx.arc(x + w - 8 + layerOffset, y + 8 - layerOffset, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.fillText((item.layer + 1).toString(), x + w - 8 + layerOffset, y + 8 - layerOffset);
  }
  
  ctx.restore();
};

const drawCommodityBadges = (
  ctx: CanvasRenderingContext2D,
  commodity: Commodity,
  x: number,
  y: number,
  w: number,
  h: number,
  layerOffset: number
) => {
  let badgeY = y + 18 - layerOffset;
  
  if (commodity.fragileLevel !== 'normal') {
    ctx.fillStyle = commodity.fragileLevel === 'very_fragile' ? '#F53F3F' : '#FF7D00';
    ctx.fillRect(x + 4 + layerOffset, badgeY - 10, 16, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('易碎', x + 6 + layerOffset, badgeY);
    badgeY += 18;
  }
  
  if (commodity.timeLevel !== 'normal') {
    const timeColors: Record<string, string> = {
      next_day: '#722ED1',
      same_day: '#165DFF',
      express: '#F53F3F',
    };
    const timeLabels: Record<string, string> = {
      next_day: '次日',
      same_day: '当日',
      express: '特快',
    };
    ctx.fillStyle = timeColors[commodity.timeLevel] || '#722ED1';
    ctx.fillRect(x + 4 + layerOffset, badgeY - 10, 24, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(timeLabels[commodity.timeLevel] || '时效', x + 6 + layerOffset, badgeY);
  }
  
  const weightColors: Record<string, string> = {
    light: '#00B42A',
    medium: '#FF7D00',
    heavy: '#F53F3F',
    super_heavy: '#86909C',
  };
  ctx.fillStyle = weightColors[commodity.weightLevel] || '#00B42A';
  ctx.beginPath();
  ctx.arc(x + w - 12 + layerOffset, y + h - 12 - layerOffset, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(commodity.weight.toFixed(1), x + w - 12 + layerOffset, y + h - 10 - layerOffset);
};

export const drawPreviewItem = (
  ctx: CanvasRenderingContext2D,
  commodity: Commodity,
  x: number,
  y: number,
  layer: number,
  rotation: number,
  isValid: boolean,
  offsetX: number,
  offsetY: number,
  pixelGridSize: number
) => {
  const isRotated = rotation % 180 !== 0;
  const w = (isRotated ? commodity.height : commodity.width) * pixelGridSize;
  const h = (isRotated ? commodity.width : commodity.height) * pixelGridSize;
  
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  const layerOffset = layer * 4;
  
  ctx.fillStyle = isValid ? 'rgba(0, 180, 42, 0.3)' : 'rgba(245, 63, 63, 0.3)';
  ctx.fillRect(x - w / 2 + layerOffset, y - h / 2 - layerOffset, w, h);
  
  ctx.strokeStyle = isValid ? '#00B42A' : '#F53F3F';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x - w / 2 + layerOffset, y - h / 2 - layerOffset, w, h);
  ctx.setLineDash([]);
  
  ctx.restore();
};

export const drawCenterOfGravity = (
  ctx: CanvasRenderingContext2D,
  cog: { x: number; y: number },
  boxType: BoxType,
  offsetX: number,
  offsetY: number,
  pixelGridSize: number
) => {
  const cogX = offsetX + cog.x * pixelGridSize;
  const cogY = offsetY + cog.y * pixelGridSize;
  const centerX = offsetX + (boxType.width * pixelGridSize) / 2;
  const centerY = offsetY + (boxType.height * pixelGridSize) / 2;
  
  ctx.strokeStyle = 'rgba(22, 93, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(cogX, cogY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.fillStyle = '#165DFF';
  ctx.beginPath();
  ctx.arc(cogX, cogY, 6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cogX, cogY, 3, 0, Math.PI * 2);
  ctx.fill();
};

const darkenColor = (color: string, amount: number): string => {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
  const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
};

export const render = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  boxType: BoxType,
  placedItems: PlacedItem[],
  options: DrawOptions
) => {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  ctx.fillStyle = '#F7F8FA';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  const pixelGridSize = boxType.gridSize;
  const boxPixelWidth = boxType.width * pixelGridSize;
  const boxPixelHeight = boxType.height * pixelGridSize;
  const offsetX = (canvasWidth - boxPixelWidth) / 2;
  const offsetY = (canvasHeight - boxPixelHeight) / 2;
  
  drawBox(ctx, boxType, offsetX, offsetY, pixelGridSize);
  
  const sortedItems = [...placedItems].sort((a, b) => a.layer - b.layer);
  for (const item of sortedItems) {
    const isViolation = options.violationCommodityIds.includes(item.commodityId);
    drawCommodity(ctx, item, offsetX, offsetY, pixelGridSize, isViolation);
  }
  
  if (options.previewItem) {
    const { commodity, x, y, layer, rotation, isValid } = options.previewItem;
    drawPreviewItem(
      ctx,
      commodity,
      offsetX + x * pixelGridSize,
      offsetY + y * pixelGridSize,
      layer,
      rotation,
      isValid,
      offsetX,
      offsetY,
      pixelGridSize
    );
  }
};
