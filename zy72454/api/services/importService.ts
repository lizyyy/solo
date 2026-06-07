import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { BusCardImportItem, ImportPreviewResult, ImportBatch } from '../../shared/types.js';
import { recordChange } from './historyService.js';

const generateBreakpointId = (name: string, location: string): string => {
  return `bp-${hashString(`${name}-${location}`).slice(0, 8)}`;
};

const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

export const parseImportData = (content: string, format: 'csv' | 'json'): BusCardImportItem[] => {
  if (format === 'json') {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  const lines = content.split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',').map((h) => h.trim());
  const items: BusCardImportItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const item: Record<string, string | number> = {};
    headers.forEach((h, idx) => {
      item[h] = values[idx] || '';
    });

    items.push({
      breakpointName: String(item.breakpointName || item.断点名称 || item.name || ''),
      location: String(item.location || item.位置 || item.address || ''),
      lat: Number(item.lat || item.纬度 || 0),
      lng: Number(item.lng || item.经度 || 0),
      timeSlot: String(item.timeSlot || item.时段 || item.slot || ''),
      passengerCount: Number(item.passengerCount || item.客流量 || item.count || 0),
      sourceDate: String(item.sourceDate || item.日期 || item.date || ''),
    });
  }

  return items;
};

export const previewImport = (items: BusCardImportItem[]): ImportPreviewResult => {
  const duplicates: BusCardImportItem[] = [];
  const validItems: BusCardImportItem[] = [];
  const newBreakpoints = new Set<string>();

  for (const item of items) {
    const bpId = generateBreakpointId(item.breakpointName, item.location);

    const existingBp = db
      .prepare('SELECT id FROM breakpoints WHERE id = ?')
      .get(bpId) as { id: string } | undefined;

    if (!existingBp) {
      newBreakpoints.add(item.breakpointName);
    }

    const existingRecord = db
      .prepare(
        `SELECT 1 FROM bus_card_times 
         WHERE breakpoint_id = ? AND time_slot = ? AND source_date = ?`
      )
      .get(bpId, item.timeSlot, item.sourceDate);

    if (existingRecord) {
      duplicates.push(item);
    } else {
      validItems.push(item);
    }
  }

  return {
    items: validItems,
    duplicates,
    totalCount: items.length,
    duplicateCount: duplicates.length,
    newBreakpoints: Array.from(newBreakpoints),
  };
};

export const executeImport = (
  items: BusCardImportItem[],
  fileName: string,
  importedBy: string
): ImportBatch => {
  const batchId = uuidv4();
  const now = new Date().toISOString();
  const preview = previewImport(items);

  let importedCount = 0;
  const breakpointIds = new Set<string>();

  for (const item of preview.items) {
    const bpId = generateBreakpointId(item.breakpointName, item.location);
    breakpointIds.add(bpId);

    const existingBp = db
      .prepare('SELECT id, created_at FROM breakpoints WHERE id = ?')
      .get(bpId) as { id: string; created_at: string } | undefined;

    if (!existingBp) {
      db.prepare(
        `INSERT INTO breakpoints 
         (id, name, location, lat, lng, status, has_construction_detour, redline_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending_inspection', 0, NULL, ?, ?)`
      ).run(bpId, item.breakpointName, item.location, item.lat, item.lng, now, now);

      recordChange(
        bpId,
        'status',
        null,
        'pending_inspection',
        importedBy,
        'create',
        {
          source: 'import',
          breakpoint: {
            name: item.breakpointName,
            location: item.location,
          },
        }
      );
    }

    try {
      db.prepare(
        `INSERT INTO bus_card_times 
         (id, breakpoint_id, import_batch_id, time_slot, passenger_count, source_date, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        uuidv4(),
        bpId,
        batchId,
        item.timeSlot,
        item.passengerCount,
        item.sourceDate,
        now
      );
      importedCount++;
    } catch (e) {
      // unique constraint violation - skip
    }
  }

  db.prepare(
    `INSERT INTO import_batches 
     (id, file_name, total_records, duplicate_count, imported_count, imported_by, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    batchId,
    fileName,
    preview.totalCount,
    preview.duplicateCount,
    importedCount,
    importedBy,
    now
  );

  return {
    id: batchId,
    fileName,
    totalRecords: preview.totalCount,
    duplicateCount: preview.duplicateCount,
    importedCount,
    importedBy,
    importedAt: now,
  };
};

export const listImportBatches = (): ImportBatch[] => {
  const rows = db
    .prepare('SELECT * FROM import_batches ORDER BY imported_at DESC')
    .all() as Array<{
    id: string;
    file_name: string;
    total_records: number;
    duplicate_count: number;
    imported_count: number;
    imported_by: string;
    imported_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    totalRecords: row.total_records,
    duplicateCount: row.duplicate_count,
    importedCount: row.imported_count,
    importedBy: row.imported_by,
    importedAt: row.imported_at,
  }));
};

export const getSampleCsvContent = (): string => {
  return `breakpointName,location,lat,lng,timeSlot,passengerCount,sourceDate
绿道北段断点A,中山路与和平大道交叉口,30.5928,114.3055,早高峰(7-9),125,2026-06-01
绿道北段断点A,中山路与和平大道交叉口,30.5928,114.3055,晚高峰(17-19),203,2026-06-01
绿道中段断点B,解放公园东门南侧,30.6012,114.2987,午间(12-14),88,2026-06-01
`;
};
