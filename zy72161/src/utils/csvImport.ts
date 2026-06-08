import {
  CsvRawRow,
  ColumnMapping,
  ImportFieldKey,
  ImportFieldDef,
  ImportPreviewItem,
  importFieldDefs,
  ShelterPoint,
  ShelterStatus,
  ConflictType,
  FeedbackSource,
} from '../types';
import { normalizeLocationName, getAliases, similarity } from './deduplicate';
import { checkCoordinateOffset } from './geo';
import { generateCapacityAnalysis } from './nlGenerator';

export function parseCSV(text: string): { headers: string[]; rows: CsvRawRow[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCSVLine(lines[0]);
  const rows: CsvRawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = values[idx] || '';
    });
    rows.push({ _rowIndex: i, _raw: raw });
  }

  return { headers, rows };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const field of importFieldDefs) {
    let bestHeader = '';
    let bestScore = 0;

    for (const header of headers) {
      const h = header.replace(/[\s\-\_（()）]/g, '').toLowerCase();

      for (const hint of field.hints) {
        const ht = hint.replace(/[\s\-\_（()）]/g, '').toLowerCase();
        if (h === ht) {
          if (1 > bestScore) {
            bestScore = 1;
            bestHeader = header;
          }
        } else if (h.includes(ht) || ht.includes(h)) {
          const score = 0.8;
          if (score > bestScore) {
            bestScore = score;
            bestHeader = header;
          }
        } else {
          const sim = similarity(h, ht);
          if (sim > 0.7 && sim > bestScore) {
            bestScore = sim;
            bestHeader = header;
          }
        }
      }
    }

    if (bestHeader && bestScore > 0.5) {
      mapping[field.key] = bestHeader;
    }
  }

  return mapping;
}

export function extractMappedValue(
  row: CsvRawRow,
  mapping: ColumnMapping,
  fieldKey: ImportFieldKey
): string {
  const colName = mapping[fieldKey];
  if (!colName) return '';
  return row._raw[colName] || '';
}

export function buildPreviews(
  rows: CsvRawRow[],
  mapping: ColumnMapping,
  existingShelters: ShelterPoint[]
): ImportPreviewItem[] {
  const previews: ImportPreviewItem[] = [];

  for (const row of rows) {
    const rawName = extractMappedValue(row, mapping, 'standardName');
    if (!rawName) continue;

    const normalizedName = normalizeLocationName(rawName);

    const matched = existingShelters.find(s => s.standardName === normalizedName);

    const mappedValues: Partial<Record<ImportFieldKey, string>> = {};
    for (const field of importFieldDefs) {
      const val = extractMappedValue(row, mapping, field.key);
      if (val) mappedValues[field.key] = val;
    }

    let isDuplicate = false;
    let duplicateReason = '';
    if (matched) {
      const reporter = mappedValues.reporter || '';
      const reportTime = mappedValues.reportTime || '';
      const existingFeedbacks = existingShelters.filter(
        s => s.standardName === normalizedName
      );
      if (reporter && existingFeedbacks.length > 0) {
        isDuplicate = true;
        duplicateReason = `点位"${normalizedName}"已存在于系统中，反馈人"${reporter}"需检查是否重复`;
      }
    }

    previews.push({
      rawName,
      normalizedName,
      matchedShelterId: matched?.id || null,
      isDuplicate,
      duplicateReason,
      rowIndex: row._rowIndex,
      mappedValues,
    });
  }

  return previews;
}

const timePeriodMap: Record<string, string> = {
  '早高峰': 'morning',
  '上午': 'morning',
  '午间': 'noon',
  '中午': 'noon',
  '下午': 'afternoon',
  '晚高峰': 'evening',
  '晚上': 'evening',
  '晚间': 'evening',
  '夜间': 'night',
  '深夜': 'night',
};

export function buildSheltersFromImport(
  previews: ImportPreviewItem[],
  existingShelters: ShelterPoint[],
  operator: string
): {
  newShelters: ShelterPoint[];
  newFeedbacks: FeedbackSource[];
  newRecords: Omit<import('../types').ProcessRecord, 'id' | 'operateTime'>[];
  updatedShelters: ShelterPoint[];
} {
  const newShelters: ShelterPoint[] = [];
  const newFeedbacks: FeedbackSource[] = [];
  const newRecords: Omit<import('../types').ProcessRecord, 'id' | 'operateTime'>[] = [];
  const updatedShelters: ShelterPoint[] = [...existingShelters];
  const groupedByNormalizedName = new Map<string, ImportPreviewItem[]>();

  for (const preview of previews) {
    const existing = groupedByNormalizedName.get(preview.normalizedName);
    if (existing) {
      existing.push(preview);
    } else {
      groupedByNormalizedName.set(preview.normalizedName, [preview]);
    }
  }

  for (const [normalizedName, group] of groupedByNormalizedName) {
    const firstItem = group[0];
    const existingIdx = updatedShelters.findIndex(s => s.standardName === normalizedName);
    const lng = parseFloat(firstItem.mappedValues.longitude || '0');
    const lat = parseFloat(firstItem.mappedValues.latitude || '0');
    const reportedLng = firstItem.mappedValues.reportedLongitude
      ? parseFloat(firstItem.mappedValues.reportedLongitude) : undefined;
    const reportedLat = firstItem.mappedValues.reportedLatitude
      ? parseFloat(firstItem.mappedValues.reportedLatitude) : undefined;
    const designCapacity = parseInt(firstItem.mappedValues.designCapacity || '0', 10);
    const maxReportedCount = Math.max(
      ...group.map(p => parseInt(p.mappedValues.reportedCount || '0', 10))
    );

    let hasCoordinateConflict = false;
    if (reportedLng && reportedLat && existingIdx >= 0) {
      const offset = checkCoordinateOffset(lat, lng, reportedLat, reportedLng);
      hasCoordinateConflict = offset.hasOffset;
    } else if (reportedLng && reportedLat && existingIdx < 0) {
      const offset = checkCoordinateOffset(lat, lng, reportedLat, reportedLng);
      hasCoordinateConflict = offset.hasOffset;
    }

    const hasCapacityConflict = maxReportedCount > designCapacity;
    let conflictType = ConflictType.NONE;
    if (hasCapacityConflict && hasCoordinateConflict) {
      conflictType = ConflictType.MIXED;
    } else if (hasCapacityConflict) {
      conflictType = ConflictType.CAPACITY;
    } else if (hasCoordinateConflict) {
      conflictType = ConflictType.COORDINATE;
    }

    const capacityByTime: Record<string, number> = {
      morning: 0, noon: 0, afternoon: 0, evening: 0, night: 0,
    };
    for (const item of group) {
      const period = timePeriodMap[item.mappedValues.timePeriod || ''] || 'morning';
      const count = parseInt(item.mappedValues.reportedCount || '0', 10);
      capacityByTime[period] = Math.max(capacityByTime[period], count);
    }

    if (existingIdx >= 0) {
      const existing = updatedShelters[existingIdx];
      const allAliases = new Set(existing.aliases);
      for (const item of group) {
        if (item.rawName !== normalizedName) allAliases.add(item.rawName);
      }

      const merged = {
        ...existing,
        aliases: Array.from(allAliases),
        reportedCount: Math.max(existing.reportedCount, maxReportedCount),
        conflictType: conflictType !== ConflictType.NONE ? conflictType : existing.conflictType,
        capacityByTime: {
          ...existing.capacityByTime,
          ...capacityByTime,
        },
        updatedAt: new Date().toLocaleString('zh-CN'),
        reportedLongitude: reportedLng ?? existing.reportedLongitude,
        reportedLatitude: reportedLat ?? existing.reportedLatitude,
      };
      merged.naturalLanguageResult = generateCapacityAnalysis(merged);
      updatedShelters[existingIdx] = merged;

      newRecords.push({
        shelterId: existing.id,
        operator,
        action: 'CSV导入更新',
        oldStatus: existing.status,
        newStatus: existing.status,
        remark: `从CSV导入更新点位数据，原始名称包括：${group.map(g => g.rawName).join('、')}，最大反馈人数${maxReportedCount}人`,
      });
    } else {
      const allAliases = getAliases(normalizedName);
      for (const item of group) {
        if (item.rawName !== normalizedName) allAliases.push(item.rawName);
      }
      const uniqueAliases = Array.from(new Set(allAliases));

      const status = conflictType !== ConflictType.NONE
        ? ShelterStatus.PENDING_VERIFY
        : ShelterStatus.PROCESSED;

      const shelter: ShelterPoint = {
        id: `s-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        standardName: normalizedName,
        aliases: uniqueAliases,
        longitude: lng,
        latitude: lat,
        reportedLongitude: reportedLng,
        reportedLatitude: reportedLat,
        designCapacity,
        reportedCount: maxReportedCount,
        status,
        sourceIds: [],
        conflictType,
        capacityByTime,
        naturalLanguageResult: '',
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN'),
      };
      shelter.naturalLanguageResult = generateCapacityAnalysis(shelter);
      newShelters.push(shelter);

      newRecords.push({
        shelterId: shelter.id,
        operator,
        action: 'CSV导入新增',
        oldStatus: status,
        newStatus: status,
        remark: `从CSV导入新增点位，原始名称：${group.map(g => g.rawName).join('、')}，设计容量${designCapacity}人，反馈${maxReportedCount}人`,
      });
    }

    for (const item of group) {
      const shelterForFeedback = existingIdx >= 0
        ? updatedShelters[existingIdx]
        : newShelters[newShelters.length - 1];

      const feedback: FeedbackSource = {
        id: `f-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rawText: item.mappedValues.remark || `${item.rawName}反馈${item.mappedValues.reportedCount}人`,
        reporter: item.mappedValues.reporter || '未知',
        reportTime: item.mappedValues.reportTime || new Date().toLocaleString('zh-CN'),
        locationDescription: item.rawName,
        reportedPeople: parseInt(item.mappedValues.reportedCount || '0', 10),
        timePeriod: timePeriodMap[item.mappedValues.timePeriod || ''] || 'morning',
        shelterId: shelterForFeedback.id,
        isDuplicate: item.isDuplicate,
      };
      newFeedbacks.push(feedback);
    }
  }

  return { newShelters, newFeedbacks, newRecords, updatedShelters };
}
