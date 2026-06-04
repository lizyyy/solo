import type { GameConfig, ValidationResult, Level, GameEvent } from '@/types/gameTypes';

export function validateConfig(config: GameConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const emptyLevels: string[] = [];
  const duplicateEvents: string[] = [];
  const boundaryIssues: string[] = [];

  if (!config.id) {
    errors.push('配置缺少 ID');
  }

  if (!config.name) {
    errors.push('配置缺少名称');
  }

  if (!config.levels || config.levels.length === 0) {
    errors.push('配置中没有关卡');
  }

  if (!config.initialResources) {
    errors.push('配置缺少初始资源');
  }

  if (config.levels) {
    const eventIds = new Set<string>();
    const eventNames = new Map<string, number>();

    for (const level of config.levels) {
      if (!level.id) {
        errors.push(`存在缺少 ID 的关卡`);
        continue;
      }

      if (!level.events || level.events.length === 0) {
        emptyLevels.push(level.id);
        warnings.push(`关卡"${level.name || level.id}"没有事件，运行时会被跳过`);
      }

      for (const event of level.events || []) {
        if (!event.id) {
          errors.push(`关卡"${level.name}"中存在缺少 ID 的事件`);
          continue;
        }

        if (eventIds.has(event.id)) {
          duplicateEvents.push(event.id);
          warnings.push(`事件 ID"${event.id}"重复，运行时会记录重复次数`);
        }
        eventIds.add(event.id);

        const nameCount = (eventNames.get(event.name) || 0) + 1;
        eventNames.set(event.name, nameCount);
        if (nameCount > 1 && !duplicateEvents.includes(event.name)) {
          duplicateEvents.push(event.name);
          warnings.push(`事件名"${event.name}"出现 ${nameCount} 次`);
        }
      }
    }
  }

  if (config.initialResources && config.resourceBoundaries) {
    for (const [key, value] of Object.entries(config.initialResources)) {
      const boundary = config.resourceBoundaries[key];
      if (boundary) {
        if (value < boundary.min) {
          boundaryIssues.push(key);
          warnings.push(`资源"${key}"初始值 ${value} 低于下限 ${boundary.min}`);
        }
        if (value > boundary.max) {
          boundaryIssues.push(key);
          warnings.push(`资源"${key}"初始值 ${value} 超过上限 ${boundary.max}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    emptyLevels,
    duplicateEvents,
    boundaryIssues,
  };
}

export function checkNegativeResources(
  resources: Record<string, number>,
  boundaries: Record<string, { min: number; max: number }>
): { hasNegative: boolean; negativeKeys: string[]; boundaryOverflows: string[] } {
  const negativeKeys: string[] = [];
  const boundaryOverflows: string[] = [];

  for (const [key, value] of Object.entries(resources)) {
    if (value < 0) {
      negativeKeys.push(key);
    }
    const boundary = boundaries[key];
    if (boundary) {
      if (value < boundary.min) {
        boundaryOverflows.push(key);
      }
      if (value > boundary.max) {
        boundaryOverflows.push(key);
      }
    }
  }

  return {
    hasNegative: negativeKeys.length > 0,
    negativeKeys,
    boundaryOverflows,
  };
}

export function markEmptyLevels(levels: Level[]): Level[] {
  return levels.map(level => ({
    ...level,
    isEmpty: !level.events || level.events.length === 0,
  }));
}

export function findDuplicateEvents(levels: Level[]): { eventId: string; count: number; levelIds: string[] }[] {
  const eventMap = new Map<string, { count: number; levelIds: Set<string> }>();

  for (const level of levels) {
    for (const event of level.events || []) {
      const existing = eventMap.get(event.id);
      if (existing) {
        existing.count += 1;
        existing.levelIds.add(level.id);
      } else {
        eventMap.set(event.id, { count: 1, levelIds: new Set([level.id]) });
      }
    }
  }

  return Array.from(eventMap.entries())
    .filter(([, data]) => data.count > 1)
    .map(([eventId, data]) => ({
      eventId,
      count: data.count,
      levelIds: Array.from(data.levelIds),
    }));
}
