import { recordRepository } from '../repositories/recordRepository';
import { detectAllConflicts } from './conflictDetector';
import type { BikeRecord, ImportRawItem, ImportResult, SourceInfo } from '../../shared/types';

export class ImportService {
  parseCSV(csvContent: string): ImportRawItem[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const items: ImportRawItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });

      items.push({
        stationName: obj['stationName'] || obj['站点名称'] || '',
        exitNo: obj['exitNo'] || obj['出口编号'] || '',
        lat: parseFloat(obj['lat'] || obj['纬度'] || '0'),
        lng: parseFloat(obj['lng'] || obj['经度'] || '0'),
        timeSlot: obj['timeSlot'] || obj['时段'] || '',
        bikeCount: parseInt(obj['bikeCount'] || obj['单车数量'] || '0'),
        capacity: parseInt(obj['capacity'] || obj['容量'] || '0'),
        reason: obj['reason'] || obj['疏导原因'] || '',
        source: {
          type: (obj['sourceType'] || obj['来源类型'] || 'inspection') as SourceInfo['type'],
          name: obj['sourceName'] || obj['来源名称'] || '未命名材料',
          date: obj['sourceDate'] || obj['来源日期'] || new Date().toISOString().split('T')[0],
          rawContent: obj['sourceContent'] || obj['原始内容'] || lines[i],
        },
      });
    }

    return items;
  }

  parseJSON(jsonContent: string): ImportRawItem[] {
    try {
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.records && Array.isArray(parsed.records)) return parsed.records;
      if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
      return [parsed];
    } catch (e) {
      throw new Error('JSON解析失败，请检查格式');
    }
  }

  async importRawItems(rawItems: ImportRawItem[]): Promise<ImportResult> {
    const conflictResults = detectAllConflicts(rawItems);
    const conflictMap = new Map(conflictResults.map(c => [c.index, c.conflicts]));
    const now = new Date().toISOString();

    const records: BikeRecord[] = [];
    let withIssues = 0;
    const allIssues: ImportResult['issues'] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const conflicts = conflictMap.get(i) || [];

      if (conflicts.length > 0) {
        withIssues++;
        allIssues.push(...conflicts);
      }

      const source: SourceInfo = {
        id: '',
        type: item.source.type,
        name: item.source.name,
        date: item.source.date,
        rawContent: item.source.rawContent,
        importTime: now,
      };

      const record = recordRepository.create({
        stationName: item.stationName,
        exitNo: item.exitNo,
        lat: item.lat,
        lng: item.lng,
        timeSlot: item.timeSlot,
        bikeCount: item.bikeCount,
        capacity: item.capacity,
        reason: item.reason,
        status: 'pending',
        notes: '',
        sources: [source],
        conflicts: conflicts,
        mergedFrom: [],
        isOldCaliber: item.source.type === 'old_caliber',
      });

      records.push(record);
    }

    return {
      total: rawItems.length,
      success: records.length,
      withIssues,
      issues: allIssues,
      records,
    };
  }

  previewImport(rawItems: ImportRawItem[]): ImportResult {
    const conflictResults = detectAllConflicts(rawItems);
    const conflictMap = new Map(conflictResults.map(c => [c.index, c.conflicts]));
    const now = new Date().toISOString();

    const records: BikeRecord[] = [];
    let withIssues = 0;
    const allIssues: ImportResult['issues'] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const conflicts = conflictMap.get(i) || [];

      if (conflicts.length > 0) {
        withIssues++;
        allIssues.push(...conflicts);
      }

      const source: SourceInfo = {
        id: `preview-${i}`,
        type: item.source.type,
        name: item.source.name,
        date: item.source.date,
        rawContent: item.source.rawContent,
        importTime: now,
      };

      records.push({
        id: `preview-${i}`,
        stationName: item.stationName,
        exitNo: item.exitNo,
        lat: item.lat,
        lng: item.lng,
        timeSlot: item.timeSlot,
        bikeCount: item.bikeCount,
        capacity: item.capacity,
        reason: item.reason,
        status: 'pending',
        notes: '',
        sources: [source],
        conflicts: conflicts,
        mergedFrom: [],
        createTime: now,
        updateTime: now,
        isOldCaliber: item.source.type === 'old_caliber',
      });
    }

    return {
      total: rawItems.length,
      success: records.length,
      withIssues,
      issues: allIssues,
      records,
    };
  }
}

export const importService = new ImportService();
