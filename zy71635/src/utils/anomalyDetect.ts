import type {
  Hall,
  ReflectSurface,
  SeatZone,
  FrequencyPoint,
  AnomalyRecord,
  AnomalySeverity,
  TraceLink,
} from './types';
import { isSurfaceThroughWall } from './reflectCalc';

const STANDARD_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000];

export function detectSurfaceThroughWall(
  surfaces: ReflectSurface[],
  hall: Hall
): AnomalyRecord[] {
  const records: AnomalyRecord[] = [];
  for (const surface of surfaces) {
    const result = isSurfaceThroughWall(surface, hall);
    if (result.through) {
      records.push({
        id: `anomaly-wall-${surface.id}`,
        type: 'SURFACE_THROUGH_WALL',
        severity: 'critical' as AnomalySeverity,
        sourceType: 'ReflectSurface',
        sourceId: surface.id,
        description: result.details,
        status: 'pending',
        traceChain: [
          { entity: 'Hall', id: hall.id, label: hall.name },
          { entity: 'ReflectSurface', id: surface.id, label: surface.name },
        ] as TraceLink[],
      });
    }
  }
  return records;
}

export function detectZoneMappingError(
  paths: { zoneId: string }[],
  zones: SeatZone[],
  hall: Hall
): AnomalyRecord[] {
  const records: AnomalyRecord[] = [];
  const zoneIds = new Set(zones.map((z) => z.id));
  for (const path of paths) {
    if (!zoneIds.has(path.zoneId)) {
      records.push({
        id: `anomaly-zone-${path.zoneId}`,
        type: 'ZONE_MAPPING_ERROR',
        severity: 'warning' as AnomalySeverity,
        sourceType: 'SeatZone',
        sourceId: path.zoneId,
        description: `反射路径引用了不存在的座区编号 ${path.zoneId}，座区映射可能存在错误`,
        status: 'pending',
        traceChain: [
          { entity: 'Hall', id: hall.id, label: hall.name },
          { entity: 'SeatZone', id: path.zoneId, label: path.zoneId },
        ] as TraceLink[],
      });
    }
  }
  return records;
}

export function detectFrequencyMissing(
  zones: SeatZone[],
  frequencyPoints: FrequencyPoint[],
  paths: { id: string; zoneId: string }[],
  hall: Hall
): AnomalyRecord[] {
  const records: AnomalyRecord[] = [];
  for (const zone of zones) {
    const zonePaths = paths.filter((p) => p.zoneId === zone.id);
    const zonePathIds = new Set(zonePaths.map((p) => p.id));
    const zoneFreqs = new Set<number>();
    for (const fp of frequencyPoints) {
      if (zonePathIds.has(fp.pathId)) {
        zoneFreqs.add(fp.frequency);
      }
    }
    for (const freq of STANDARD_FREQUENCIES) {
      if (!zoneFreqs.has(freq)) {
        records.push({
          id: `anomaly-freq-${zone.id}-${freq}`,
          type: 'FREQUENCY_MISSING',
          severity: 'warning' as AnomalySeverity,
          sourceType: 'FrequencyPoint',
          sourceId: `${zone.id}-${freq}`,
          description: `座区 ${zone.name} 在 ${freq}Hz 频段无反射数据，覆盖评估可能不完整`,
          status: 'pending',
          traceChain: [
            { entity: 'Hall', id: hall.id, label: hall.name },
            { entity: 'SeatZone', id: zone.id, label: zone.name },
            { entity: 'FrequencyPoint', id: `${zone.id}-${freq}`, label: `${freq}Hz` },
          ] as TraceLink[],
        });
      }
    }
  }
  return records;
}

export function detectAllAnomalies(
  hall: Hall,
  surfaces: ReflectSurface[],
  zones: SeatZone[],
  paths: { id: string; zoneId: string }[],
  frequencyPoints: FrequencyPoint[]
): AnomalyRecord[] {
  return [
    ...detectSurfaceThroughWall(surfaces, hall),
    ...detectZoneMappingError(paths, zones, hall),
    ...detectFrequencyMissing(zones, frequencyPoints, paths, hall),
  ];
}
