import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from './database';
import {
  BloodBag,
  CreateBloodBagInput,
  UpdateBloodBagInput,
  AddTemperatureRecordInput,
  BloodBagFilter,
  TemperatureRecord,
  BloodBagStatus,
  BloodType,
  BloodComponentType,
} from '../types';

export function createBloodBag(input: CreateBloodBagInput): BloodBag {
  const now = new Date().toISOString();
  const id = uuidv4();

  const initialTempRecords: TemperatureRecord[] = input.initialTemperature
    ? [
        {
          timestamp: now,
          temperature: input.initialTemperature,
          location: '血库入库',
        },
      ]
    : [];

  const bloodBag: BloodBag = {
    id,
    bloodType: input.bloodType,
    componentType: input.componentType,
    volume: input.volume,
    donorId: input.donorId,
    collectionDate: input.collectionDate,
    expiryDate: input.expiryDate,
    crossMatchStatus: input.crossMatchStatus || 'PENDING',
    temperatureRecords: initialTempRecords,
    status: 'AVAILABLE',
    lockedBy: null,
    lockedUntil: null,
    reservedForApplicationId: null,
    issuedToWardId: null,
    issuedAt: null,
    receivedAt: now,
    lastUpdatedAt: now,
    notes: input.notes || null,
  };

  run(`
    INSERT INTO blood_bags (
      id, blood_type, component_type, volume, donor_id, collection_date,
      expiry_date, cross_match_status, temperature_records, status,
      locked_by, locked_until, reserved_for_application_id, issued_to_ward_id,
      issued_at, received_at, last_updated_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    bloodBag.id,
    bloodBag.bloodType,
    bloodBag.componentType,
    bloodBag.volume,
    bloodBag.donorId,
    bloodBag.collectionDate,
    bloodBag.expiryDate,
    bloodBag.crossMatchStatus,
    JSON.stringify(bloodBag.temperatureRecords),
    bloodBag.status,
    bloodBag.lockedBy,
    bloodBag.lockedUntil,
    bloodBag.reservedForApplicationId,
    bloodBag.issuedToWardId,
    bloodBag.issuedAt,
    bloodBag.receivedAt,
    bloodBag.lastUpdatedAt,
    bloodBag.notes
  ]);

  return bloodBag;
}

export function getBloodBagById(id: string): BloodBag | null {
  const row = get('SELECT * FROM blood_bags WHERE id = ?', [id]);
  if (!row) return null;
  return mapRowToBloodBag(row);
}

export function getBloodBags(filter: BloodBagFilter = {}): BloodBag[] {
  let query = 'SELECT * FROM blood_bags WHERE 1=1';
  const params: unknown[] = [];

  if (filter.bloodType) {
    query += ' AND blood_type = ?';
    params.push(filter.bloodType);
  }
  if (filter.componentType) {
    query += ' AND component_type = ?';
    params.push(filter.componentType);
  }
  if (filter.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }
  if (filter.crossMatchStatus) {
    query += ' AND cross_match_status = ?';
    params.push(filter.crossMatchStatus);
  }
  if (filter.isExpiringSoon) {
    const hours = filter.expiringWithinHours || 48;
    const cutoffTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    query += ' AND expiry_date <= ? AND status = ?';
    params.push(cutoffTime, 'AVAILABLE');
  }

  query += ' ORDER BY expiry_date ASC, received_at ASC';

  let rows = all(query, params);

  if (filter.hasTemperatureAnomaly) {
    rows = rows.filter((row) => {
      const records = JSON.parse(row.temperature_records as string);
      return hasTemperatureAnomaly(records);
    });
  }

  return rows.map((row) => mapRowToBloodBag(row));
}

export function getAvailableBloodBags(
  bloodType: BloodType,
  componentType: BloodComponentType,
  crossMatchRequired: boolean
): BloodBag[] {
  let query = `
    SELECT * FROM blood_bags 
    WHERE blood_type = ? 
    AND component_type = ? 
    AND status = ?
  `;
  const params: unknown[] = [bloodType, componentType, 'AVAILABLE'];

  if (crossMatchRequired) {
    query += " AND cross_match_status IN ('COMPATIBLE', 'NOT_REQUIRED')";
  }

  query += ' ORDER BY expiry_date ASC, received_at ASC';

  const rows = all(query, params);
  return rows.map((row) => mapRowToBloodBag(row));
}

export function updateBloodBagStatus(
  id: string,
  status: BloodBagStatus,
  options?: {
    reservedForApplicationId?: string;
    issuedToWardId?: string;
    lockedBy?: string;
    lockedUntil?: string;
  }
): BloodBag | null {
  const existing = getBloodBagById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['status = ?', 'last_updated_at = ?'];
  const values: unknown[] = [status, now];

  if (options?.reservedForApplicationId !== undefined) {
    updates.push('reserved_for_application_id = ?');
    values.push(options.reservedForApplicationId);
  }
  if (options?.issuedToWardId !== undefined) {
    updates.push('issued_to_ward_id = ?');
    values.push(options.issuedToWardId);
    if (options.issuedToWardId) {
      updates.push('issued_at = ?');
      values.push(now);
    }
  }
  if (options?.lockedBy !== undefined) {
    updates.push('locked_by = ?');
    values.push(options.lockedBy);
  }
  if (options?.lockedUntil !== undefined) {
    updates.push('locked_until = ?');
    values.push(options.lockedUntil);
  }

  values.push(id);

  run(`UPDATE blood_bags SET ${updates.join(', ')} WHERE id = ?`, values);

  return getBloodBagById(id);
}

export function updateBloodBag(id: string, input: UpdateBloodBagInput): BloodBag | null {
  const existing = getBloodBagById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['last_updated_at = ?'];
  const values: unknown[] = [now];

  if (input.crossMatchStatus !== undefined) {
    updates.push('cross_match_status = ?');
    values.push(input.crossMatchStatus);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    values.push(input.notes || null);
  }

  values.push(id);

  run(`UPDATE blood_bags SET ${updates.join(', ')} WHERE id = ?`, values);

  return getBloodBagById(id);
}

export function addTemperatureRecord(input: AddTemperatureRecordInput): BloodBag | null {
  const existing = getBloodBagById(input.bloodBagId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const newRecord: TemperatureRecord = {
    timestamp: now,
    temperature: input.temperature,
    location: input.location,
  };

  const updatedRecords = [...existing.temperatureRecords, newRecord];

  run(`
    UPDATE blood_bags 
    SET temperature_records = ?, last_updated_at = ? 
    WHERE id = ?
  `, [JSON.stringify(updatedRecords), now, input.bloodBagId]);

  return getBloodBagById(input.bloodBagId);
}

export function checkTemperatureAnomaly(bloodBag: BloodBag): boolean {
  return hasTemperatureAnomaly(bloodBag.temperatureRecords);
}

function hasTemperatureAnomaly(records: TemperatureRecord[]): boolean {
  if (records.length === 0) return false;

  for (const record of records) {
    if (record.temperature < 1 || record.temperature > 6) {
      return true;
    }
  }

  if (records.length >= 2) {
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      const hoursDiff = (currTime - prevTime) / (1000 * 60 * 60);

      if (hoursDiff > 0.5 && hoursDiff <= 4) {
        if (Math.abs(curr.temperature - prev.temperature) > 2) {
          return true;
        }
      }
    }
  }

  return false;
}

function mapRowToBloodBag(row: Record<string, unknown>): BloodBag {
  return {
    id: row.id as string,
    bloodType: row.blood_type as BloodType,
    componentType: row.component_type as BloodComponentType,
    volume: row.volume as number,
    donorId: row.donor_id as string,
    collectionDate: row.collection_date as string,
    expiryDate: row.expiry_date as string,
    crossMatchStatus: row.cross_match_status as 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED',
    temperatureRecords: JSON.parse(row.temperature_records as string),
    status: row.status as BloodBagStatus,
    lockedBy: row.locked_by as string | null,
    lockedUntil: row.locked_until as string | null,
    reservedForApplicationId: row.reserved_for_application_id as string | null,
    issuedToWardId: row.issued_to_ward_id as string | null,
    issuedAt: row.issued_at as string | null,
    receivedAt: row.received_at as string,
    lastUpdatedAt: row.last_updated_at as string,
    notes: row.notes as string | null,
  };
}
