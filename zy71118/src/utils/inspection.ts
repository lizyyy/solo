import { Store, Shelf, ShelfLayer, InspectionIssue } from '../types';

function generateId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function checkDuplicateSkus(layer: ShelfLayer, shelfId: string): InspectionIssue[] {
  const issues: InspectionIssue[] = [];
  const skuPositions: Record<string, number[]> = {};

  layer.slots.forEach((slot, index) => {
    if (!slot.isOutOfStock) {
      if (!skuPositions[slot.skuId]) {
        skuPositions[slot.skuId] = [];
      }
      skuPositions[slot.skuId].push(index);
    }
  });

  Object.entries(skuPositions).forEach(([skuId, positions]) => {
    if (positions.length > 1) {
      const slot = layer.slots[positions[0]];
      issues.push({
        id: generateId(),
        type: 'duplicate_sku',
        severity: layer.isGolden ? 'high' : 'medium',
        description: `SKU重复占位: ${slot.skuName} 在层板${layer.index}出现${positions.length}次`,
        shelfId,
        layerIndex: layer.index,
        skuId,
      });
    }
  });

  return issues;
}

export function checkGoldenLayer(layer: ShelfLayer, shelfId: string): InspectionIssue[] {
  const issues: InspectionIssue[] = [];
  
  if (layer.isGolden) {
    const occupiedSlots = layer.slots.filter(s => !s.isOutOfStock).length;
    const utilizationRate = occupiedSlots / layer.capacity;
    
    if (utilizationRate < 0.7) {
      issues.push({
        id: generateId(),
        type: 'golden_layer_violation',
        severity: 'high',
        description: `黄金层利用率不足: 当前${occupiedSlots}/${layer.capacity}个位置, 利用率${Math.round(utilizationRate * 100)}%`,
        shelfId,
        layerIndex: layer.index,
      });
    }
    
    const outOfStock = layer.slots.filter(s => s.isOutOfStock).length;
    if (outOfStock > 0) {
      issues.push({
        id: generateId(),
        type: 'out_of_stock',
        severity: 'high',
        description: `黄金层缺货: 有${outOfStock}个位置缺货`,
        shelfId,
        layerIndex: layer.index,
      });
    }
  }
  
  return issues;
}

export function checkEndcapBlocked(shelf: Shelf): InspectionIssue[] {
  const issues: InspectionIssue[] = [];
  
  if (shelf.isEndcap && shelf.isBlocked) {
    issues.push({
      id: generateId(),
      type: 'endcap_blocked',
      severity: 'high',
      description: '端架被遮挡: 端架前方有障碍物，影响动线和展示效果',
      shelfId: shelf.id,
      position: { x: shelf.x, z: shelf.z },
    });
  }
  
  return issues;
}

export function checkOutOfStock(layer: ShelfLayer, shelfId: string): InspectionIssue[] {
  const issues: InspectionIssue[] = [];
  
  layer.slots.forEach((slot) => {
    if (slot.isOutOfStock) {
      issues.push({
        id: generateId(),
        type: 'out_of_stock',
        severity: layer.isGolden ? 'high' : 'low',
        description: `缺货洞: ${slot.skuName} 在层板${layer.index}位置${slot.position}缺货`,
        shelfId,
        layerIndex: layer.index,
        skuId: slot.skuId,
      });
    }
  });
  
  return issues;
}

export function runFullInspection(store: Store): InspectionIssue[] {
  const allIssues: InspectionIssue[] = [];

  store.shelves.forEach((shelf) => {
    allIssues.push(...checkEndcapBlocked(shelf));
    
    shelf.layers.forEach((layer) => {
      allIssues.push(...checkDuplicateSkus(layer, shelf.id));
      allIssues.push(...checkGoldenLayer(layer, shelf.id));
      if (!layer.isGolden) {
        allIssues.push(...checkOutOfStock(layer, shelf.id));
      }
    });
  });

  return allIssues;
}

export function getIssueStats(issues: InspectionIssue[]): {
  total: number;
  bySeverity: { high: number; medium: number; low: number };
  byType: Record<string, number>;
} {
  const stats = {
    total: issues.length,
    bySeverity: { high: 0, medium: 0, low: 0 },
    byType: {} as Record<string, number>,
  };

  issues.forEach((issue) => {
    stats.bySeverity[issue.severity]++;
    stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
  });

  return stats;
}

export function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate_sku: 'SKU重复占位',
    golden_layer_violation: '黄金层违规',
    endcap_blocked: '端架遮挡',
    out_of_stock: '缺货',
  };
  return labels[type] || type;
}
