import type { PlacedItem, Commodity, BoxType } from '../../types/game';
import { getCommodityById } from '../../data/commodities';

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getCommodityAABB = (
  item: PlacedItem,
  commodity?: Commodity
): AABB => {
  const comm = commodity || getCommodityById(item.commodityId);
  if (!comm) return { x: 0, y: 0, width: 0, height: 0 };
  
  const isRotated = item.rotation % 180 !== 0;
  const width = isRotated ? comm.height : comm.width;
  const height = isRotated ? comm.width : comm.height;
  
  return {
    x: item.x,
    y: item.y,
    width,
    height,
  };
};

export const checkAABBCollision = (a: AABB, b: AABB): boolean => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
};

export const calculateOverlapArea = (a: AABB, b: AABB): number => {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapX * overlapY;
};

export const checkCollision = (
  newItem: PlacedItem,
  placedItems: PlacedItem[],
  layer: number
): PlacedItem | null => {
  const newAABB = getCommodityAABB(newItem);
  
  for (const item of placedItems) {
    if (item.instanceId === newItem.instanceId) continue;
    if (item.layer !== layer) continue;
    
    const itemAABB = getCommodityAABB(item);
    if (checkAABBCollision(newAABB, itemAABB)) {
      return item;
    }
  }
  
  return null;
};

export const isWithinBox = (
  item: PlacedItem,
  boxType: BoxType
): boolean => {
  const aabb = getCommodityAABB(item);
  return (
    aabb.x >= 0 &&
    aabb.y >= 0 &&
    aabb.x + aabb.width <= boxType.width &&
    aabb.y + aabb.height <= boxType.height
  );
};

export const isItemAbove = (
  topItem: PlacedItem,
  bottomItem: PlacedItem
): boolean => {
  if (topItem.layer <= bottomItem.layer) return false;
  
  const topAABB = getCommodityAABB(topItem);
  const bottomAABB = getCommodityAABB(bottomItem);
  
  const overlapArea = calculateOverlapArea(topAABB, bottomAABB);
  const bottomArea = bottomAABB.width * bottomAABB.height;
  
  return overlapArea / bottomArea > 0.5;
};

export const findItemsBelow = (
  item: PlacedItem,
  placedItems: PlacedItem[]
): PlacedItem[] => {
  return placedItems.filter(
    placed => placed.instanceId !== item.instanceId && isItemAbove(item, placed)
  );
};

export const findItemsAbove = (
  item: PlacedItem,
  placedItems: PlacedItem[]
): PlacedItem[] => {
  return placedItems.filter(
    placed => placed.instanceId !== item.instanceId && isItemAbove(placed, item)
  );
};

export const snapToGrid = (
  x: number,
  y: number,
  gridSize: number = 1
): { x: number; y: number } => {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
};
