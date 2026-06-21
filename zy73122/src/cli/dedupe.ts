import type { BuoyCliRecord, LatLonSwapCandidate, ValidatedRow } from './types';

export function detectLatLonSwap(rows: ValidatedRow[]): LatLonSwapCandidate[] {
  const candidates: LatLonSwapCandidate[] = [];

  for (const row of rows) {
    const reasons: string[] = [];
    const { latitude: lat, longitude: lon, latRaw, lonRaw } = row;

    if (lat === 0 || lon === 0) continue;

    const absLat = Math.abs(lat);
    const absLon = Math.abs(lon);

    if (absLat > 90) {
      reasons.push(`纬度绝对值 ${absLat} > 90°，超出纬度合法范围`);
    }
    if (absLon > 180) {
      reasons.push(`经度绝对值 ${absLon} > 180°，超出经度合法范围`);
    }

    if (absLat > 75 && absLon < 75) {
      reasons.push(`纬度(${absLat})远大于经度(${absLon})，疑似经纬度写反`);
    }

    const hasLatDirection = /[NS]$/i.test(latRaw.trim());
    const hasLonDirection = /[EW]$/i.test(lonRaw.trim());
    if (!hasLatDirection && !hasLonDirection) {
      if (absLon < 40 && absLat > 100) {
        reasons.push('两个值都没有方向标记，且数值范围疑似颠倒');
      }
    }
    if (hasLatDirection && /[EW]/i.test(latRaw.trim())) {
      reasons.push(`纬度值 "${latRaw}" 含经度方向符(E/W)，疑似反写`);
    }
    if (hasLonDirection && /[NS]/i.test(lonRaw.trim())) {
      reasons.push(`经度值 "${lonRaw}" 含纬度方向符(N/S)，疑似反写`);
    }

    if (reasons.length > 0) {
      candidates.push({
        lineNumber: row.lineNumber,
        buoyId: row.buoyId,
        recordTime: row.recordTime,
        originalLat: lat,
        originalLon: lon,
        originalLatRaw: latRaw,
        originalLonRaw: lonRaw,
        swappedLat: lon,
        swappedLon: lat,
        reason: reasons.join('；'),
      });
    }
  }

  return candidates;
}

export interface DedupeOutcome {
  newRecords: BuoyCliRecord[];
  updatedRecords: BuoyCliRecord[];
  skippedDuplicate: BuoyCliRecord[];
  skippedRemarkProtected: BuoyCliRecord[];
}

export function applyDeduplication(
  existingMap: Map<string, BuoyCliRecord>,
  incoming: BuoyCliRecord[],
  getKey: (r: BuoyCliRecord) => string,
): DedupeOutcome {
  const outcome: DedupeOutcome = {
    newRecords: [],
    updatedRecords: [],
    skippedDuplicate: [],
    skippedRemarkProtected: [],
  };

  for (const rec of incoming) {
    const key = getKey(rec);
    const existing = existingMap.get(key);

    if (!existing) {
      outcome.newRecords.push(rec);
      continue;
    }

    const hasRemark = existing.manualRemark && existing.manualRemark.trim().length > 0;
    if (hasRemark) {
      outcome.skippedRemarkProtected.push(existing);
      continue;
    }

    const sameContent =
      existing.seaState === rec.seaState &&
      existing.waveHeight === rec.waveHeight &&
      existing.windSpeed === rec.windSpeed &&
      existing.latitude === rec.latitude &&
      existing.longitude === rec.longitude;

    if (sameContent && !rec.manualRemark) {
      outcome.skippedDuplicate.push(existing);
      continue;
    }

    const updated: BuoyCliRecord = {
      ...rec,
      id: existing.id,
      manualRemark: existing.manualRemark ?? rec.manualRemark,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    outcome.updatedRecords.push(updated);
  }

  return outcome;
}
