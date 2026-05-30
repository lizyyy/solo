import {
  PlacedPolygon,
  PolygonBlock,
  Level,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types';
import { checkPolygonOverlap, checkPolygonsConnected, getPolygonBoundingBox, distance } from './geometry';

export const validateBridge = (
  placedPolygons: PlacedPolygon[],
  polygonBlocks: PolygonBlock[],
  level: Level
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (placedPolygons.length === 0) {
    errors.push({
      type: 'no_bridge',
      message: '请先放置多边形构建桥梁',
      details: {}
    });
    return { valid: false, errors, warnings };
  }

  const usedArea = calculateUsedArea(placedPolygons, polygonBlocks);
  if (usedArea > level.areaBudget) {
    errors.push({
      type: 'area_exceeded',
      message: `面积超出预算！已使用 ${usedArea.toFixed(1)}，预算 ${level.areaBudget}`,
      details: {
        used: usedArea,
        budget: level.areaBudget,
        excess: usedArea - level.areaBudget
      }
    });
  }

  const overlapErrors = checkOverlaps(placedPolygons, polygonBlocks);
  errors.push(...overlapErrors);

  const connectionErrors = checkConnections(placedPolygons, level);
  errors.push(...connectionErrors);

  const gapWarning = checkBridgeGaps(placedPolygons, level);
  if (gapWarning) {
    warnings.push(gapWarning);
  }

  if (placedPolygons.length < 3 && level.difficulty !== 'easy') {
    warnings.push({
      type: 'few_polygons',
      message: '使用的多边形数量较少，建议增加结构增强稳定性',
      details: { count: placedPolygons.length }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export const calculateUsedArea = (
  placedPolygons: PlacedPolygon[],
  polygonBlocks: PolygonBlock[]
): number => {
  let totalArea = 0;
  for (const placed of placedPolygons) {
    const block = polygonBlocks.find(b => b.id === placed.blockId);
    if (block) {
      totalArea += block.area;
    }
  }
  return totalArea;
};

const checkOverlaps = (
  placedPolygons: PlacedPolygon[],
  polygonBlocks: PolygonBlock[]
): ValidationError[] => {
  const errors: ValidationError[] = [];
  for (let i = 0; i < placedPolygons.length; i++) {
    for (let j = i + 1; j < placedPolygons.length; j++) {
      const poly1 = placedPolygons[i];
      const poly2 = placedPolygons[j];
      if (checkPolygonOverlap(poly1.vertices, poly2.vertices)) {
        const block1 = polygonBlocks.find(b => b.id === poly1.blockId);
        const block2 = polygonBlocks.find(b => b.id === poly2.blockId);
        errors.push({
          type: 'overlap',
          message: `多边形「${block1?.name || '未知'}」与「${block2?.name || '未知'}」发生重叠`,
          polygonId: poly1.instanceId,
          details: {
            polygon1Id: poly1.instanceId,
            polygon2Id: poly2.instanceId,
            polygon1Name: block1?.name,
            polygon2Name: block2?.name
          }
        });
      }
    }
  }
  return errors;
};

const checkConnections = (
  placedPolygons: PlacedPolygon[],
  level: Level
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const connectedToStart = new Set<string>();
  const connectedToEnd = new Set<string>();

  const startPier = level.piers[0];
  const endPier = level.piers[level.piers.length - 1];

  for (const placed of placedPolygons) {
    if (startPier) {
      const pierTop = { x: startPier.position.x, y: startPier.position.y - startPier.height / 2 };
      for (const v of placed.vertices) {
        if (distance(v, pierTop) <= 25) {
          connectedToStart.add(placed.instanceId);
          break;
        }
      }
    }
    if (endPier) {
      const pierTop = { x: endPier.position.x, y: endPier.position.y - endPier.height / 2 };
      for (const v of placed.vertices) {
        if (distance(v, pierTop) <= 25) {
          connectedToEnd.add(placed.instanceId);
          break;
        }
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const placed of placedPolygons) {
      if (connectedToStart.has(placed.instanceId)) continue;
      for (const connectedId of connectedToStart) {
        const connected = placedPolygons.find(p => p.instanceId === connectedId);
        if (connected && checkPolygonsConnected(placed.vertices, connected.vertices, 20)) {
          connectedToStart.add(placed.instanceId);
          changed = true;
          break;
        }
      }
    }
  }

  changed = true;
  while (changed) {
    changed = false;
    for (const placed of placedPolygons) {
      if (connectedToEnd.has(placed.instanceId)) continue;
      for (const connectedId of connectedToEnd) {
        const connected = placedPolygons.find(p => p.instanceId === connectedId);
        if (connected && checkPolygonsConnected(placed.vertices, connected.vertices, 20)) {
          connectedToEnd.add(placed.instanceId);
          changed = true;
          break;
        }
      }
    }
  }

  const fullyConnected = new Set(
    [...connectedToStart].filter(id => connectedToEnd.has(id))
  );

  if (fullyConnected.size === 0) {
    errors.push({
      type: 'not_connected',
      message: '桥梁未连通起点和终点，请确保多边形从左桥墩连接到右桥墩',
      details: {
        connectedToStart: connectedToStart.size,
        connectedToEnd: connectedToEnd.size,
        total: placedPolygons.length
      }
    });
  } else if (fullyConnected.size < placedPolygons.length) {
    const isolated = placedPolygons.filter(p => !fullyConnected.has(p.instanceId));
    errors.push({
      type: 'not_connected',
      message: `有 ${isolated.length} 个多边形未连接到主桥梁结构`,
      details: {
        isolatedCount: isolated.length,
        isolatedIds: isolated.map(p => p.instanceId)
      }
    });
  }

  return errors;
};

const checkBridgeGaps = (
  placedPolygons: PlacedPolygon[],
  level: Level
): ValidationWarning | null => {
  if (placedPolygons.length < 2) return null;
  const allX: number[] = [];
  for (const placed of placedPolygons) {
    const bbox = getPolygonBoundingBox(placed.vertices);
    allX.push(bbox.minX, bbox.maxX);
  }
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const bridgeWidth = maxX - minX;
  const expectedWidth = level.bridgeWidth * 0.8;

  if (bridgeWidth < expectedWidth) {
    return {
      type: 'gap_detected',
      message: '桥梁可能存在缺口，建议检查是否完全覆盖通行区域',
      details: {
        currentWidth: bridgeWidth,
        expectedWidth
      }
    };
  }
  return null;
};

export const getErrorIcon = (type: string): string => {
  const icons: Record<string, string> = {
    area_exceeded: '📐',
    not_connected: '🔗',
    overlap: '⚠️',
    not_closed: '⭕',
    no_bridge: '🏗️',
    gap_detected: '🕳️'
  };
  return icons[type] || '❌';
};

export const getSuggestions = (
  validationResult: ValidationResult,
  usedArea: number,
  areaBudget: number
): string[] => {
  const suggestions: string[] = [];
  if (usedArea < areaBudget * 0.5) {
    suggestions.push('面积预算使用较少，考虑增加结构提高稳定性');
  }
  for (const error of validationResult.errors) {
    switch (error.type) {
      case 'area_exceeded':
        suggestions.push('尝试使用面积较小的多边形，或减少多边形数量');
        suggestions.push('三角形结构比矩形更节省材料');
        break;
      case 'not_connected':
        suggestions.push('确保每个多边形都与相邻的多边形或桥墩相连');
        suggestions.push('顶点对齐有助于建立连接');
        break;
      case 'overlap':
        suggestions.push('重叠区域会造成材料浪费，尝试调整位置');
        suggestions.push('使用旋转功能更好地拟合空间');
        break;
    }
  }
  if (validationResult.warnings.some(w => w.type === 'few_polygons')) {
    suggestions.push('三角形桁架结构能有效分散应力');
  }
  return suggestions;
};
