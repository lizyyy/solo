import { Musician, MonitorPoint, SceneIssue, Vector3 } from '../types';
import {
  SOUND_OVERLAP_THRESHOLD,
  MIN_MONITOR_SOUND_LEVEL,
  MAX_VOLUME_RATIO,
  MIN_VOLUME_RATIO,
} from './constants';
import { generateId, distance2D, roundTo } from './helpers';
import { calculateCombinedSoundPressure, calculateSoundPressure } from './soundField';

export const detectSourceOverlap = (
  musicians: Musician[],
  threshold: number = SOUND_OVERLAP_THRESHOLD
): SceneIssue[] => {
  const issues: SceneIssue[] = [];

  for (let i = 0; i < musicians.length; i++) {
    for (let j = i + 1; j < musicians.length; j++) {
      const dist = distance2D(musicians[i].position, musicians[j].position);
      if (dist < threshold) {
        issues.push({
          id: generateId(),
          planId: musicians[i].planId,
          type: 'source_overlap',
          severity: 'error',
          message: `${musicians[i].name} 与 ${musicians[j].name} 站位过近`,
          suggestion: `将两位乐手分开至少 ${threshold}m，建议沿不同方向调整站位`,
          details: {
            distance: roundTo(dist, 2),
            threshold,
            musician1: { id: musicians[i].id, name: musicians[i].name },
            musician2: { id: musicians[j].id, name: musicians[j].name },
          },
          detectedAt: new Date(),
          relatedObjectIds: [musicians[i].id, musicians[j].id],
        });
      }
    }
  }

  return issues;
};

export const detectMissingMonitor = (
  monitorPoints: MonitorPoint[],
  musicians: Musician[]
): SceneIssue[] => {
  if (monitorPoints.length === 0) {
    return [{
      id: generateId(),
      planId: musicians[0]?.planId || '',
      type: 'missing_monitor',
      severity: 'warning',
      message: '未配置监听点，建议在听音位置添加监听点',
      suggestion: '在房间前方中央位置添加至少一个监听点，用于评估混音效果',
      details: {
        suggestion: '在房间前方中央位置添加至少一个监听点，用于评估混音效果',
      },
      detectedAt: new Date(),
      relatedObjectIds: [],
    }];
  }

  return monitorPoints
    .filter(mp => {
      const avgDb = calculateCombinedSoundPressure(musicians, mp.position);
      return avgDb < MIN_MONITOR_SOUND_LEVEL;
    })
    .map(mp => ({
      id: generateId(),
      planId: mp.planId,
      type: 'missing_monitor',
      severity: 'warning',
      message: `监听点 "${mp.name}" 位于声场覆盖边缘`,
      suggestion: '将监听点向乐手方向移动，或提高声源强度',
      details: {
        monitorPointId: mp.id,
        monitorPointName: mp.name,
        soundLevel: roundTo(calculateCombinedSoundPressure(musicians, mp.position), 1),
        minLevel: MIN_MONITOR_SOUND_LEVEL,
        suggestion: '将监听点向乐手方向移动，或提高声源强度',
      },
      detectedAt: new Date(),
      relatedObjectIds: [mp.id],
    }));
};

export const detectVolumeImbalance = (
  musicians: Musician[],
  monitorPoints: MonitorPoint[]
): SceneIssue[] => {
  if (monitorPoints.length === 0 || musicians.length < 2) return [];

  const issues: SceneIssue[] = [];

  monitorPoints.forEach(mp => {
    const levels = musicians.map(m => ({
      musician: m,
      level: calculateSoundPressure(
        m.position,
        mp.position,
        m.sourceLevel,
        m.directivity,
        m.rotation
      ),
    }));

    const totalLinear = levels.reduce(
      (sum, l) => sum + Math.pow(10, l.level / 20),
      0
    );

    levels.forEach(({ musician, level }) => {
      const linearPressure = Math.pow(10, level / 20);
      const ratio = totalLinear > 0 ? linearPressure / totalLinear : 0;

      if (ratio > MAX_VOLUME_RATIO) {
        issues.push({
          id: generateId(),
          planId: mp.planId,
          type: 'volume_imbalance',
          severity: 'warning',
          message: `监听点 "${mp.name}" 处 ${musician.name} 音量占比过高`,
          suggestion: `降低 ${musician.name} 的声源强度约 ${Math.round((ratio - MAX_VOLUME_RATIO) * 100)}%`,
          details: {
            monitorPointId: mp.id,
            monitorPointName: mp.name,
            musicianId: musician.id,
            musicianName: musician.name,
            ratio: roundTo(ratio * 100, 1),
            maxRatio: MAX_VOLUME_RATIO * 100,
            soundLevel: roundTo(level, 1),
            suggestion: `降低 ${musician.name} 的声源强度约 ${Math.round((ratio - MAX_VOLUME_RATIO) * 100)}%`,
          },
          detectedAt: new Date(),
          relatedObjectIds: [mp.id, musician.id],
        });
      } else if (ratio < MIN_VOLUME_RATIO) {
        issues.push({
          id: generateId(),
          planId: mp.planId,
          type: 'volume_imbalance',
          severity: 'warning',
          message: `监听点 "${mp.name}" 处 ${musician.name} 音量占比过低`,
          suggestion: `提高 ${musician.name} 的声源强度，或将其位置向监听点移动`,
          details: {
            monitorPointId: mp.id,
            monitorPointName: mp.name,
            musicianId: musician.id,
            musicianName: musician.name,
            ratio: roundTo(ratio * 100, 1),
            minRatio: MIN_VOLUME_RATIO * 100,
            soundLevel: roundTo(level, 1),
            suggestion: `提高 ${musician.name} 的声源强度，或将其位置向监听点移动`,
          },
          detectedAt: new Date(),
          relatedObjectIds: [mp.id, musician.id],
        });
      }
    });
  });

  return issues;
};

export const runAllSceneValidations = (
  musicians: Musician[],
  monitorPoints: MonitorPoint[]
): SceneIssue[] => {
  const overlapIssues = detectSourceOverlap(musicians);
  const monitorIssues = detectMissingMonitor(monitorPoints, musicians);
  const balanceIssues = detectVolumeImbalance(musicians, monitorPoints);

  return [...overlapIssues, ...monitorIssues, ...balanceIssues];
};

export const getIssueTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    source_overlap: '声源重叠',
    missing_monitor: '监听缺失',
    volume_imbalance: '音量失衡',
  };
  return labels[type] || '未知问题';
};

export const getIssueIcon = (type: string): string => {
  const icons: Record<string, string> = {
    source_overlap: '⚠️',
    missing_monitor: '📍',
    volume_imbalance: '🔊',
  };
  return icons[type] || '❓';
};

export const isObjectInvolvedInIssue = (
  objectId: string,
  issues: SceneIssue[]
): SceneIssue | undefined => {
  return issues.find(issue => issue.relatedObjectIds.includes(objectId));
};
