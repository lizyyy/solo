import {
  Anomaly,
  AnomalyType,
  AnomalyStatus,
  DataSource,
  AnomalyEvidence,
  Hall,
  Corner,
  Artwork,
  Door,
  Light,
  DoorAccessLog,
} from './types';
import { GAME_CONFIG, ANOMALY_WEIGHTS } from './config';
import { MOCK_CORNERS } from '../mock/halls';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const totalWeight = Object.values(weights).reduce<number>((sum, w) => sum + (w as number), 0);
  let random = Math.random() * totalWeight;
  
  for (const [key, weight] of Object.entries(weights)) {
    random -= weight as number;
    if (random <= 0) {
      return key as T;
    }
  }
  return Object.keys(weights)[0] as T;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEvidence(
  anomalyType: AnomalyType,
  relatedEntityId: string,
  triggerTime: number,
  isTrueAnomaly: boolean
): AnomalyEvidence[] {
  const evidence: AnomalyEvidence[] = [];

  switch (anomalyType) {
    case AnomalyType.MISSED_CORNER: {
      evidence.push({
        source: DataSource.HALL,
        data: { cornerId: relatedEntityId, lastPatrolTime: null },
        timestamp: triggerTime - 60,
      });
      evidence.push({
        source: DataSource.ROUTE,
        data: { plannedRoute: '不包含此角落' },
        timestamp: triggerTime - 30,
      });
      break;
    }
    case AnomalyType.DOOR_FALSE_ALARM: {
      evidence.push({
        source: DataSource.DOOR,
        data: { doorId: relatedEntityId, alarmType: isTrueAnomaly ? '非法闯入' : '传感器故障', alarmCount: isTrueAnomaly ? 1 : 5 },
        timestamp: triggerTime,
      });
      if (!isTrueAnomaly) {
        evidence.push({
          source: DataSource.LIGHT,
          data: { lightStatus: '正常', noMovement: true },
          timestamp: triggerTime,
        });
      }
      break;
    }
    case AnomalyType.ART_VIBRATION: {
      evidence.push({
        source: DataSource.ART,
        data: { artworkId: relatedEntityId, vibrationValue: isTrueAnomaly ? 75 : 55, threshold: 50 },
        timestamp: triggerTime,
      });
      evidence.push({
        source: DataSource.HALL,
        data: { hallId: '', motionDetected: isTrueAnomaly },
        timestamp: triggerTime,
      });
      break;
    }
    case AnomalyType.LIGHT_ABNORMAL: {
      evidence.push({
        source: DataSource.LIGHT,
        data: { lightId: relatedEntityId, status: isTrueAnomaly ? 'fault' : 'off', brightness: isTrueAnomaly ? 0 : 10 },
        timestamp: triggerTime,
      });
      break;
    }
  }

  return evidence;
}

function getCorrectAction(anomalyType: AnomalyType, isTrueAnomaly: boolean): AnomalyStatus {
  if (!isTrueAnomaly) {
    return AnomalyStatus.FALSE_ALARM;
  }
  if (anomalyType === AnomalyType.MISSED_CORNER) {
    return AnomalyStatus.CONFIRMED;
  }
  return AnomalyStatus.CONFIRMED;
}

function getDescription(anomalyType: AnomalyType, entityName: string, isTrueAnomaly: boolean): string {
  switch (anomalyType) {
    case AnomalyType.MISSED_CORNER:
      return `角落 "${entityName}" 已超过60分钟未巡查`;
    case AnomalyType.DOOR_FALSE_ALARM:
      return isTrueAnomaly
        ? `门禁 "${entityName}" 检测到异常开启`
        : `门禁 "${entityName}" 频繁触发告警（可能误报）`;
    case AnomalyType.ART_VIBRATION:
      return isTrueAnomaly
        ? `作品 "${entityName}" 检测到异常震动`
        : `作品 "${entityName}" 震动传感器数值波动（可能误报）`;
    case AnomalyType.LIGHT_ABNORMAL:
      return `灯光 "${entityName}" 状态异常`;
  }
}

function getExplanation(anomalyType: AnomalyType, isTrueAnomaly: boolean): string {
  switch (anomalyType) {
    case AnomalyType.MISSED_CORNER:
      return '角落是监控盲区，必须定期巡查。长时间漏巡可能导致展品被盗或损坏无法及时发现。正确做法：立即前往巡查并确认安全。';
    case AnomalyType.DOOR_FALSE_ALARM:
      return isTrueAnomaly
        ? '门禁告警显示异常开启，结合灯光和展厅数据确认有人非法进入。正确做法：确认异常，立即前往处理并上报。'
        : '门禁频繁告警但无其他异常数据佐证，属于传感器故障导致的误报。正确做法：标记为误报，记录并安排技术检修。';
    case AnomalyType.ART_VIBRATION:
      return isTrueAnomaly
        ? '作品震动超过阈值且展厅检测到移动，表明有人触碰展品。正确做法：确认异常，立即前往检查。'
        : '震动数值略超阈值但持续时间短，无其他异常数据，可能是环境振动或传感器误差。正确做法：标记为误报，持续观察。';
    case AnomalyType.LIGHT_ABNORMAL:
      return '灯光故障可能是电路问题或人为破坏。正确做法：确认异常，安排检修并记录。';
  }
}

export function generateAnomalies(
  halls: Hall[],
  corners: Corner[],
  artworks: Artwork[],
  doors: Door[],
  lights: Light[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const count = Math.floor(
    Math.random() * (GAME_CONFIG.ANOMALY_COUNT_MAX - GAME_CONFIG.ANOMALY_COUNT_MIN + 1)
  ) + GAME_CONFIG.ANOMALY_COUNT_MIN;

  const usedEntities = new Set<string>();

  for (let i = 0; i < count; i++) {
    const type = weightedRandom<AnomalyType>(ANOMALY_WEIGHTS as Record<AnomalyType, number>);
    const isTrueAnomaly = Math.random() < GAME_CONFIG.TRUE_ANOMALY_RATIO;

    let relatedEntityId: string;
    let entityName: string;
    let source: DataSource;

    switch (type) {
      case AnomalyType.MISSED_CORNER: {
        const available = corners.filter(c => !usedEntities.has(c.id));
        if (available.length === 0) continue;
        const corner = getRandomItem(available);
        relatedEntityId = corner.id;
        entityName = corner.name;
        source = DataSource.HALL;
        usedEntities.add(corner.id);
        break;
      }
      case AnomalyType.DOOR_FALSE_ALARM: {
        const available = doors.filter(d => d.hallId && !usedEntities.has(d.id));
        if (available.length === 0) continue;
        const door = getRandomItem(available);
        relatedEntityId = door.id;
        entityName = door.name;
        source = DataSource.DOOR;
        usedEntities.add(door.id);
        break;
      }
      case AnomalyType.ART_VIBRATION: {
        const available = artworks.filter(a => a.vibrationSensor.enabled && !usedEntities.has(a.id));
        if (available.length === 0) continue;
        const artwork = getRandomItem(available);
        relatedEntityId = artwork.id;
        entityName = artwork.name;
        source = DataSource.ART;
        usedEntities.add(artwork.id);
        break;
      }
      case AnomalyType.LIGHT_ABNORMAL: {
        const available = lights.filter(l => l.hallId && !usedEntities.has(l.id));
        if (available.length === 0) continue;
        const light = getRandomItem(available);
        relatedEntityId = light.id;
        entityName = light.name;
        source = DataSource.LIGHT;
        usedEntities.add(light.id);
        break;
      }
    }

    const triggerTime = Math.floor(
      Math.random() * (GAME_CONFIG.TOTAL_TIME * 0.6) + GAME_CONFIG.TOTAL_TIME * 0.2
    );

    const anomaly: Anomaly = {
      id: generateId(),
      type,
      source,
      relatedEntityId,
      triggerTime,
      detectedTime: null,
      resolvedTime: null,
      status: AnomalyStatus.PENDING,
      playerChoice: null,
      isTrueAnomaly,
      description: getDescription(type, entityName, isTrueAnomaly),
      evidence: generateEvidence(type, relatedEntityId, triggerTime, isTrueAnomaly),
      correctAction: getCorrectAction(type, isTrueAnomaly),
      explanation: getExplanation(type, isTrueAnomaly),
    };

    anomalies.push(anomaly);
  }

  return anomalies.sort((a, b) => a.triggerTime - b.triggerTime);
}

export function generateDoorAccessLog(doorId: string, timestamp: number, type: DoorAccessLog['type'], details: string): DoorAccessLog {
  return {
    id: generateId(),
    timestamp,
    type,
    source: DataSource.DOOR,
    details,
  };
}

export function findUnpatrolledCorners(corners: Corner[], currentTime: number, threshold: number = 300): string[] {
  return corners
    .filter(c => !c.isPatrolled || (c.patrolTime !== null && currentTime - c.patrolTime > threshold))
    .map(c => c.id);
}
