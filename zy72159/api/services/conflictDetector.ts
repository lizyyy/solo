import type { BikeRecord, ConflictInfo, ImportRawItem } from '../../shared/types';

const REFERENCE_STATIONS: Record<string, { lat: number; lng: number }> = {
  '龙阳路站': { lat: 31.2148, lng: 121.5575 },
  '世纪大道站': { lat: 31.2304, lng: 121.5200 },
  '静安寺站': { lat: 31.2241, lng: 121.4482 },
  '人民广场站': { lat: 31.2304, lng: 121.4737 },
  '南京西路站': { lat: 31.2270, lng: 121.4600 },
  '徐家汇站': { lat: 31.1930, lng: 121.4370 },
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function detectCoordOffset(item: ImportRawItem | BikeRecord): ConflictInfo | null {
  const ref = REFERENCE_STATIONS[item.stationName];
  if (!ref) return null;

  const distance = haversineDistance(ref.lat, ref.lng, item.lat, item.lng);
  if (distance > 300) {
    return {
      type: 'coord_offset',
      humanMessage: `坐标偏移：${item.stationName}${item.exitNo}记录坐标与官方位置相差约${Math.round(distance)}米，请确认是否为同一疏导点`,
      relatedRecordIds: [],
      details: {
        expectedLat: ref.lat,
        expectedLng: ref.lng,
        actualLat: item.lat,
        actualLng: item.lng,
        distanceMeters: Math.round(distance),
      },
    };
  }
  return null;
}

export function detectCapacityIssue(item: ImportRawItem | BikeRecord): ConflictInfo | null {
  if (item.bikeCount > item.capacity) {
    const overflow = item.bikeCount - item.capacity;
    const percent = Math.round((overflow / item.capacity) * 100);
    return {
      type: 'capacity',
      humanMessage: `容量超限：${item.stationName}${item.exitNo}实际停放${item.bikeCount}辆，超出设计容量${item.capacity}辆，超载${overflow}辆（${percent}%），建议增加疏导力量`,
      relatedRecordIds: [],
    };
  }
  return null;
}

export function detectDuplicates(items: ImportRawItem[]): Map<string, ConflictInfo[]> {
  const result = new Map<string, ConflictInfo[]>();
  const groups = new Map<string, { index: number; item: ImportRawItem }[]>();

  items.forEach((item, index) => {
    const key = `${item.stationName}|${item.exitNo}|${item.timeSlot}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ index, item });
  });

  groups.forEach((group) => {
    if (group.length > 1) {
      const firstIndex = group[0].index;
      const firstItem = group[0].item;
      const relatedIds: string[] = [];

      for (let i = 1; i < group.length; i++) {
        const dupIndex = group[i].index;
        if (!result.has(String(dupIndex))) result.set(String(dupIndex), []);
        result.get(String(dupIndex))!.push({
          type: 'duplicate',
          humanMessage: `重复投诉：${firstItem.stationName}${firstItem.exitNo}在${firstItem.timeSlot}时段已有记录（来自${firstItem.source.name}），本条可能为重复数据`,
          relatedRecordIds: relatedIds,
        });
      }

      if (!result.has(String(firstIndex))) result.set(String(firstIndex), []);
      result.get(String(firstIndex))!.push({
        type: 'duplicate',
        humanMessage: `存在重复：${firstItem.stationName}${firstItem.exitNo}在${firstItem.timeSlot}时段共有${group.length}条记录，建议合并`,
        relatedRecordIds: relatedIds,
      });
    }
  });

  return result;
}

export function detectSameNameDifferentCoords(items: ImportRawItem[]): Map<string, ConflictInfo[]> {
  const result = new Map<string, ConflictInfo[]>();
  const groups = new Map<string, { index: number; item: ImportRawItem }[]>();

  items.forEach((item, index) => {
    const key = `${item.stationName}|${item.exitNo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ index, item });
  });

  groups.forEach((group) => {
    if (group.length > 1) {
      let hasDifferentCoords = false;
      for (let i = 1; i < group.length; i++) {
        const dist = haversineDistance(
          group[0].item.lat, group[0].item.lng,
          group[i].item.lat, group[i].item.lng
        );
        if (dist > 50) {
          hasDifferentCoords = true;
          break;
        }
      }

      if (hasDifferentCoords) {
        group.forEach(({ index, item }) => {
          if (!result.has(String(index))) result.set(String(index), []);
          result.get(String(index))!.push({
            type: 'same_name',
            humanMessage: `同名路口坐标不一致：${item.stationName}${item.exitNo}有${group.length}条记录但坐标不同，请确认是否为同一地点`,
            relatedRecordIds: [],
          });
        });
      }
    }
  });

  return result;
}

export function detectCrossTimeSlot(item: ImportRawItem): ConflictInfo | null {
  const crossTimePatterns = [/早高峰.*晚高峰/, /早晚高峰/, /全天/, /7:00.*19:00/];
  for (const pattern of crossTimePatterns) {
    if (pattern.test(item.timeSlot) || item.timeSlot.includes('全天') || item.timeSlot.includes('跨')) {
      return {
        type: 'cross_time',
        humanMessage: `跨时段统计：${item.stationName}${item.exitNo}记录时段为"${item.timeSlot}"，覆盖多个时段，建议拆分为早高峰、晚高峰分别统计`,
        relatedRecordIds: [],
      };
    }
  }
  return null;
}

export function detectAllConflicts(items: ImportRawItem[]): Array<{ index: number; conflicts: ConflictInfo[] }> {
  const result: Array<{ index: number; conflicts: ConflictInfo[] }> = [];

  const dupConflicts = detectDuplicates(items);
  const sameNameConflicts = detectSameNameDifferentCoords(items);

  items.forEach((item, index) => {
    const conflicts: ConflictInfo[] = [];

    const coordOffset = detectCoordOffset(item);
    if (coordOffset) conflicts.push(coordOffset);

    const capacity = detectCapacityIssue(item);
    if (capacity) conflicts.push(capacity);

    const crossTime = detectCrossTimeSlot(item);
    if (crossTime) conflicts.push(crossTime);

    if (dupConflicts.has(String(index))) {
      conflicts.push(...dupConflicts.get(String(index))!);
    }
    if (sameNameConflicts.has(String(index))) {
      conflicts.push(...sameNameConflicts.get(String(index))!);
    }

    if (conflicts.length > 0) {
      result.push({ index, conflicts });
    }
  });

  return result;
}
