import { recordRepository } from '../repositories/recordRepository';
import { detectCoordOffset, detectCapacityIssue } from './conflictDetector';
import type { BikeRecord, ConflictInfo, MergeRequest, MergeResult } from '../../shared/types';

export class MergeService {
  findMergeCandidates(): Array<{ key: string; records: BikeRecord[] }> {
    const allRecords = recordRepository.findAll();
    const groups = new Map<string, BikeRecord[]>();

    for (const record of allRecords) {
      if (record.mergedFrom.length > 0) continue;

      const key = `${record.stationName}|${record.exitNo}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }

    const candidates: Array<{ key: string; records: BikeRecord[] }> = [];
    groups.forEach((records, key) => {
      if (records.length > 1) {
        candidates.push({ key, records });
      }
    });

    return candidates;
  }

  mergeRecords(request: MergeRequest): MergeResult {
    const { recordIds, keepStationName, keepExitNo, keepLat, keepLng, keepTimeSlot, keepReason } = request;
    const records = recordIds.map(id => recordRepository.findById(id)).filter((r): r is BikeRecord => r !== null);

    if (records.length < 2) {
      throw new Error('至少需要2条记录才能合并');
    }

    const allSources = records.flatMap(r => r.sources);
    const allConflicts: ConflictInfo[] = [];

    let maxBikeCount = 0;
    let maxCapacity = 0;
    const timeSlots = new Set<string>();

    for (const r of records) {
      maxBikeCount = Math.max(maxBikeCount, r.bikeCount);
      maxCapacity = Math.max(maxCapacity, r.capacity);
      timeSlots.add(r.timeSlot);
      allConflicts.push(...r.conflicts);
    }

    const mergedBikeCount = records.reduce((sum, r) => sum + r.bikeCount, 0);
    const finalTimeSlot = timeSlots.size > 1
      ? `${keepTimeSlot}（合并${timeSlots.size}个时段）`
      : keepTimeSlot;

    const mergedRecordData = {
      stationName: keepStationName,
      exitNo: keepExitNo,
      lat: keepLat,
      lng: keepLng,
      timeSlot: finalTimeSlot,
      bikeCount: mergedBikeCount,
      capacity: maxCapacity,
      reason: keepReason,
      status: 'verify' as const,
      notes: `合并自 ${records.length} 条记录：${records.map(r => `${r.stationName}${r.exitNo}`).join('、')}`,
      sources: allSources,
      conflicts: allConflicts,
      mergedFrom: recordIds,
      isOldCaliber: records.some(r => r.isOldCaliber),
    };

    const coordConflict = detectCoordOffset(mergedRecordData as unknown as BikeRecord);
    if (coordConflict) mergedRecordData.conflicts.push(coordConflict);

    const capacityConflict = detectCapacityIssue(mergedRecordData as unknown as BikeRecord);
    if (capacityConflict) mergedRecordData.conflicts.push(capacityConflict);

    const humanMessage = `合并完成：${keepStationName}${keepExitNo}共合并${records.length}条记录，总车数${mergedBikeCount}辆，来源包括：${allSources.map(s => s.name).join('、')}`;
    mergedRecordData.conflicts.push({
      type: 'time_conflict',
      humanMessage,
      relatedRecordIds: recordIds,
    });

    recordRepository.deleteMany(recordIds);
    const mergedRecord = recordRepository.create(mergedRecordData);

    return {
      mergedRecord,
      mergedCount: records.length,
    };
  }

  autoMerge(): { mergedCount: number; results: MergeResult[] } {
    const candidates = this.findMergeCandidates();
    const results: MergeResult[] = [];

    for (const candidate of candidates) {
      const records = candidate.records;
      const primary = records[0];

      try {
        const result = this.mergeRecords({
          recordIds: records.map(r => r.id),
          keepStationName: primary.stationName,
          keepExitNo: primary.exitNo,
          keepLat: primary.lat,
          keepLng: primary.lng,
          keepTimeSlot: primary.timeSlot,
          keepReason: primary.reason,
        });
        results.push(result);
      } catch (e) {
        console.error('Auto merge failed:', e);
      }
    }

    return {
      mergedCount: results.length,
      results,
    };
  }

  getConflicts(): ConflictInfo[] {
    const records = recordRepository.findAll();
    return records.flatMap(r => r.conflicts);
  }

  getConflictsWithHumanMessage(): Array<{ record: BikeRecord; conflict: ConflictInfo }> {
    const records = recordRepository.findAll();
    const result: Array<{ record: BikeRecord; conflict: ConflictInfo }> = [];

    for (const record of records) {
      for (const conflict of record.conflicts) {
        result.push({ record, conflict });
      }
    }

    return result;
  }
}

export const mergeService = new MergeService();
