import type { PlacedItem, Violation, BoxType, Commodity, WeightLevel, TimeLevel } from '../../types/game';
import { getCommodityById } from '../../data/commodities';
import { findItemsBelow, findItemsAbove, getCommodityAABB, calculateOverlapArea } from './collision';

const weightLevelOrder: Record<WeightLevel, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
  super_heavy: 4,
};

const timeLevelOrder: Record<TimeLevel, number> = {
  normal: 1,
  next_day: 2,
  same_day: 3,
  express: 4,
};

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const checkHeavyOnFragile = (
  placedItems: PlacedItem[]
): Violation[] => {
  const violations: Violation[] = [];
  
  for (const item of placedItems) {
    const commodity = getCommodityById(item.commodityId);
    if (!commodity) continue;
    
    if (weightLevelOrder[commodity.weightLevel] >= weightLevelOrder.medium) {
      const itemsBelow = findItemsBelow(item, placedItems);
      
      for (const belowItem of itemsBelow) {
        const belowCommodity = getCommodityById(belowItem.commodityId);
        if (!belowCommodity) continue;
        
        if (belowCommodity.fragileLevel !== 'normal') {
          const isFatal = belowCommodity.fragileLevel === 'very_fragile';
          violations.push({
            id: generateId(),
            type: 'heavy_on_fragile',
            description: `重物「${commodity.name}」压在${isFatal ? '极易碎' : '易碎'}品「${belowCommodity.name}」上方`,
            penalty: isFatal ? -80 : -50,
            commodityId: item.commodityId,
            relatedCommodityId: belowItem.commodityId,
            isFatal,
          });
        }
      }
    }
  }
  
  return violations;
};

export const checkFragileUnder = (
  placedItems: PlacedItem[]
): Violation[] => {
  const violations: Violation[] = [];
  
  for (const item of placedItems) {
    const commodity = getCommodityById(item.commodityId);
    if (!commodity || commodity.fragileLevel === 'normal') continue;
    
    const itemsAbove = findItemsAbove(item, placedItems);
    
    for (const aboveItem of itemsAbove) {
      const aboveCommodity = getCommodityById(aboveItem.commodityId);
      if (!aboveCommodity) continue;
      
      violations.push({
        id: generateId(),
        type: 'fragile_under',
        description: `易碎品「${commodity.name}」被「${aboveCommodity.name}」压在下方`,
        penalty: -80,
        commodityId: item.commodityId,
        relatedCommodityId: aboveItem.commodityId,
        isFatal: true,
      });
    }
  }
  
  return violations;
};

export const checkTimePriority = (
  placedItems: PlacedItem[],
  boxType: BoxType
): Violation[] => {
  const violations: Violation[] = [];
  const maxLayer = Math.max(...placedItems.map(i => i.layer), 0);
  const boxCenterX = boxType.width / 2;
  
  for (const item of placedItems) {
    const commodity = getCommodityById(item.commodityId);
    if (!commodity) continue;
    
    const timePriority = timeLevelOrder[commodity.timeLevel];
    if (timePriority <= timeLevelOrder.normal) continue;
    
    const isInTopLayer = item.layer === maxLayer;
    const itemAABB = getCommodityAABB(item);
    const itemCenterX = itemAABB.x + itemAABB.width / 2;
    const distanceFromCenter = Math.abs(itemCenterX - boxCenterX);
    const normalizedDistance = distanceFromCenter / (boxType.width / 2);
    const isNearEdge = normalizedDistance > 0.6;
    
    if (!isInTopLayer && !isNearEdge) {
      violations.push({
        id: generateId(),
        type: 'time_position',
        description: `时效件「${commodity.name}」未放在易取位置（上层或外侧）`,
        penalty: -30,
        commodityId: item.commodityId,
        isFatal: false,
      });
    }
  }
  
  return violations;
};

export const calculateSpaceUtilization = (
  placedItems: PlacedItem[],
  boxType: BoxType
): number => {
  const totalBoxArea = boxType.width * boxType.height;
  
  const uniqueCells = new Set<string>();
  
  for (const item of placedItems) {
    const aabb = getCommodityAABB(item);
    for (let x = Math.floor(aabb.x); x < Math.ceil(aabb.x + aabb.width); x++) {
      for (let y = Math.floor(aabb.y); y < Math.ceil(aabb.y + aabb.height); y++) {
        uniqueCells.add(`${x},${y},${item.layer}`);
      }
    }
  }
  
  const usedArea = uniqueCells.size;
  const totalArea = totalBoxArea * (Math.max(...placedItems.map(i => i.layer), 0) + 1);
  
  return Math.min(1, usedArea / totalBoxArea);
};

export const checkSpaceWaste = (
  placedItems: PlacedItem[],
  boxType: BoxType
): Violation | null => {
  const utilization = calculateSpaceUtilization(placedItems, boxType);
  
  if (utilization < 0.7) {
    return {
      id: generateId(),
      type: 'space_waste',
      description: `空间利用率仅为${(utilization * 100).toFixed(1)}%，低于要求的70%`,
      penalty: -20,
      commodityId: '',
      isFatal: false,
    };
  }
  
  return null;
};

export const calculateCenterOfGravity = (
  placedItems: PlacedItem[]
): { x: number; y: number } => {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  
  for (const item of placedItems) {
    const commodity = getCommodityById(item.commodityId);
    if (!commodity) continue;
    
    const aabb = getCommodityAABB(item);
    const centerX = aabb.x + aabb.width / 2;
    const centerY = aabb.y + aabb.height / 2;
    
    totalWeight += commodity.weight;
    weightedX += centerX * commodity.weight;
    weightedY += centerY * commodity.weight;
  }
  
  if (totalWeight === 0) return { x: 0, y: 0 };
  
  return {
    x: weightedX / totalWeight,
    y: weightedY / totalWeight,
  };
};

export const checkCenterOfGravity = (
  placedItems: PlacedItem[],
  boxType: BoxType
): Violation | null => {
  const cog = calculateCenterOfGravity(placedItems);
  const boxCenterX = boxType.width / 2;
  const boxCenterY = boxType.height / 2;
  
  const offsetX = Math.abs(cog.x - boxCenterX) / (boxType.width / 2);
  const offsetY = Math.abs(cog.y - boxCenterY) / (boxType.height / 2);
  const maxOffset = Math.max(offsetX, offsetY);
  
  if (maxOffset > 0.3) {
    return {
      id: generateId(),
      type: 'unstable',
      description: `重心偏移${(maxOffset * 100).toFixed(1)}%，超过安全阈值30%`,
      penalty: -40,
      commodityId: '',
      isFatal: false,
    };
  }
  
  return null;
};

export const calculateTotalWeight = (placedItems: PlacedItem[]): number => {
  return placedItems.reduce((total, item) => {
    const commodity = getCommodityById(item.commodityId);
    return total + (commodity?.weight || 0);
  }, 0);
};

export const checkOverweight = (
  placedItems: PlacedItem[],
  boxType: BoxType
): Violation | null => {
  const totalWeight = calculateTotalWeight(placedItems);
  
  if (totalWeight > boxType.maxWeight) {
    return {
      id: generateId(),
      type: 'overweight',
      description: `总重量${totalWeight.toFixed(1)}kg，超过箱型承重上限${boxType.maxWeight}kg`,
      penalty: -100,
      commodityId: '',
      isFatal: true,
    };
  }
  
  return null;
};

export const runAllChecks = (
  placedItems: PlacedItem[],
  boxType: BoxType
): Violation[] => {
  const violations: Violation[] = [];
  
  violations.push(...checkHeavyOnFragile(placedItems));
  violations.push(...checkFragileUnder(placedItems));
  violations.push(...checkTimePriority(placedItems, boxType));
  
  const spaceViolation = checkSpaceWaste(placedItems, boxType);
  if (spaceViolation) violations.push(spaceViolation);
  
  const cogViolation = checkCenterOfGravity(placedItems, boxType);
  if (cogViolation) violations.push(cogViolation);
  
  const overweightViolation = checkOverweight(placedItems, boxType);
  if (overweightViolation) violations.push(overweightViolation);
  
  return violations;
};

export const checkFatalViolations = (violations: Violation[]): Violation | null => {
  const fatalViolations = violations.filter(v => v.isFatal);
  
  const heavyOnFragileCount = fatalViolations.filter(v => v.type === 'heavy_on_fragile').length;
  if (heavyOnFragileCount >= 2) {
    return fatalViolations.find(v => v.type === 'heavy_on_fragile') || null;
  }
  
  const fragileUnderCount = fatalViolations.filter(v => v.type === 'fragile_under').length;
  if (fragileUnderCount >= 1) {
    return fatalViolations.find(v => v.type === 'fragile_under') || null;
  }
  
  const timePositionCount = violations.filter(v => v.type === 'time_position').length;
  if (timePositionCount >= 3) {
    return violations.find(v => v.type === 'time_position') || null;
  }
  
  const overweightViolation = fatalViolations.find(v => v.type === 'overweight');
  if (overweightViolation) {
    return overweightViolation;
  }
  
  return null;
};
