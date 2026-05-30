import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type {
  Booking, Room, Engineer, Equipment, CustomerNote, Conflict,
  Provenance, SourceType
} from './types.js';

function now(): string {
  return new Date().toISOString();
}

function makeProvenance(source: SourceType, detail: string, originalId?: string): Provenance {
  return { source, sourceDetail: detail, importedAt: now(), originalId };
}

function readJsonFile<T>(filePath: string): T[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [data];
}

function readCsvFile<T>(filePath: string): T[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

function inferSourceType(fileName: string): SourceType {
  const lower = fileName.toLowerCase();
  if (lower.includes('email') || lower.includes('邮件')) return 'email';
  if (lower.includes('chat') || lower.includes('群') || lower.includes('微信')) return 'chat';
  if (lower.includes('spreadsheet') || lower.includes('表格') || lower.includes('excel')) return 'spreadsheet';
  if (lower.includes('legacy') || lower.includes('旧') || lower.includes('历史')) return 'legacy';
  return 'system';
}

export interface LoadedData {
  bookings: Booking[];
  rooms: Room[];
  engineers: Engineer[];
  equipment: Equipment[];
  customerNotes: CustomerNote[];
  legacyConflicts: Conflict[];
  loadErrors: { file: string; error: string }[];
}

function ensureBooking(row: Record<string, unknown>, provenance: Provenance, order: number): Booking {
  return {
    id: String(row.id ?? `BK-IMPORT-${order}`),
    clientName: String(row.clientName ?? row.client_name ?? ''),
    roomId: String(row.roomId ?? row.room_id ?? ''),
    engineerId: row.engineerId ?? row.engineer_id ?? undefined,
    date: String(row.date ?? ''),
    startTime: String(row.startTime ?? row.start_time ?? ''),
    endTime: String(row.endTime ?? row.end_time ?? ''),
    status: (String(row.status ?? 'pending')) as Booking['status'],
    equipmentIds: parseStringArray(row.equipmentIds ?? row.equipment_ids ?? []),
    notes: String(row.notes ?? ''),
    provenance,
    createdAt: String(row.createdAt ?? row.created_at ?? now()),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? now()),
    processingOrder: order,
  };
}

function ensureRoom(row: Record<string, unknown>, provenance: Provenance): Room {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    type: (String(row.type ?? 'rehearsal')) as Room['type'],
    equipmentIds: parseStringArray(row.equipmentIds ?? row.equipment_ids ?? []),
    provenance,
  };
}

function ensureEngineer(row: Record<string, unknown>, provenance: Provenance): Engineer {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    specialties: parseStringArray(row.specialties ?? []),
    provenance,
  };
}

function ensureEquipment(row: Record<string, unknown>, provenance: Provenance): Equipment {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    type: String(row.type ?? ''),
    roomId: row.roomId ?? row.room_id ?? undefined,
    quantity: Number(row.quantity ?? 1),
    provenance,
  };
}

function ensureCustomerNote(row: Record<string, unknown>, provenance: Provenance): CustomerNote {
  return {
    id: String(row.id ?? ''),
    bookingId: row.bookingId ?? row.booking_id ?? undefined,
    clientName: row.clientName ?? row.client_name ?? undefined,
    content: String(row.content ?? ''),
    provenance,
  };
}

function ensureLegacyConflict(row: Record<string, unknown>, provenance: Provenance): Conflict {
  return {
    id: String(row.id ?? ''),
    type: (String(row.type ?? 'ROOM_OVERLAP')) as Conflict['type'],
    severity: (String(row.severity ?? 'warning')) as Conflict['severity'],
    bookingIds: parseStringArray(row.bookingIds ?? row.booking_ids ?? []),
    description: String(row.description ?? ''),
    affectedResources: parseStringArray(row.affectedResources ?? row.affected_resources ?? []),
    resolutionStatus: (String(row.resolutionStatus ?? row.resolution_status ?? 'open')) as Conflict['resolutionStatus'],
    resolutionNote: row.resolutionNote ?? row.resolution_note ?? undefined,
    detectedAt: String(row.detectedAt ?? row.detected_at ?? now()),
    provenance,
  };
}

function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    if (val.startsWith('[')) {
      try { return JSON.parse(val).map(String); } catch { /* fall through */ }
    }
    return val.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function loadFromDirectory(inputDir: string): LoadedData {
  const result: LoadedData = {
    bookings: [],
    rooms: [],
    engineers: [],
    equipment: [],
    customerNotes: [],
    legacyConflicts: [],
    loadErrors: [],
  };

  const fileMap: Record<string, string[]> = {
    bookings: ['bookings', '预约', '预约单'],
    rooms: ['rooms', '房间', '房间清单'],
    engineers: ['engineers', '工程师', '排班'],
    equipment: ['equipment', '设备', '设备需求'],
    notes: ['notes', '备注', '客户备注'],
    conflicts: ['conflicts', '冲突', '冲突报告'],
  };

  const files = fs.readdirSync(inputDir);

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();
    if (ext !== '.json' && ext !== '.csv') continue;

    const baseName = path.basename(file, ext).toLowerCase();
    const sourceType = inferSourceType(file);

    let category: string | null = null;
    for (const [cat, keywords] of Object.entries(fileMap)) {
      if (keywords.some(kw => baseName.includes(kw.toLowerCase()))) {
        category = cat;
        break;
      }
    }
    if (!category) continue;

    try {
      const rawRows = ext === '.json'
        ? readJsonFile<Record<string, unknown>>(filePath)
        : readCsvFile<Record<string, unknown>>(filePath);

      const provenance = makeProvenance(sourceType, file);

      switch (category) {
        case 'bookings':
          result.bookings.push(...rawRows.map((r, i) => ensureBooking(r, provenance, result.bookings.length + i + 1)));
          break;
        case 'rooms':
          result.rooms.push(...rawRows.map(r => ensureRoom(r, provenance)));
          break;
        case 'engineers':
          result.engineers.push(...rawRows.map(r => ensureEngineer(r, provenance)));
          break;
        case 'equipment':
          result.equipment.push(...rawRows.map(r => ensureEquipment(r, provenance)));
          break;
        case 'notes':
          result.customerNotes.push(...rawRows.map(r => ensureCustomerNote(r, provenance)));
          break;
        case 'conflicts':
          result.legacyConflicts.push(...rawRows.map(r => ensureLegacyConflict(r, provenance)));
          break;
      }
    } catch (err) {
      result.loadErrors.push({ file, error: String(err) });
    }
  }

  result.bookings.sort((a, b) => {
    const da = `${a.date}T${a.startTime}`;
    const db = `${b.date}T${b.startTime}`;
    return da.localeCompare(db);
  });
  result.bookings.forEach((b, i) => { b.processingOrder = i + 1; });

  return result;
}
