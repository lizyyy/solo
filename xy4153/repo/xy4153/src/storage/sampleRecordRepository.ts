import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { SampleRecord, SampleType, User, UserRole } from '../types';
import { isValueExceeded } from './thresholdRepository';

function mapRowToSampleRecord(row: any): SampleRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    poolId: row.pool_id,
    sampleType: row.sample_type as SampleType,
    value: row.value,
    unit: row.unit,
    sampleTime: row.sample_time,
    recordedBy: row.recorded_by,
    deviceCalibrationId: row.device_calibration_id,
    isExceeded: Boolean(row.is_exceeded),
    ticketId: row.ticket_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createSampleRecord(
  storeId: string,
  poolId: string,
  sampleType: SampleType,
  value: number,
  unit: string,
  sampleTime: string,
  recordedBy: string,
  deviceCalibrationId: string | undefined,
  createdBy: User
): SampleRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();
  const isExceeded = isValueExceeded(sampleType, value);

  const insert = db.prepare(`
    INSERT INTO sample_records (
      id, store_id, pool_id, sample_type, value, unit,
      sample_time, recorded_by, device_calibration_id, is_exceeded,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, storeId, poolId, sampleType, value, unit,
    sampleTime, recordedBy, deviceCalibrationId, isExceeded ? 1 : 0,
    now, now
  );

  return {
    id,
    storeId,
    poolId,
    sampleType,
    value,
    unit,
    sampleTime,
    recordedBy,
    deviceCalibrationId,
    isExceeded,
    createdAt: now,
    updatedAt: now
  };
}

export function updateSampleRecord(
  id: string,
  updates: Partial<{
    value: number;
    sampleTime: string;
    recordedBy: string;
    deviceCalibrationId: string;
    ticketId: string;
  }>,
  updatedBy: User
): SampleRecord | null {
  const db = getDatabase();
  const existing = getSampleRecordById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.value !== undefined) {
    fields.push('value = ?');
    values.push(updates.value);
    fields.push('is_exceeded = ?');
    values.push(isValueExceeded(existing.sampleType, updates.value) ? 1 : 0);
  }
  if (updates.sampleTime !== undefined) {
    fields.push('sample_time = ?');
    values.push(updates.sampleTime);
  }
  if (updates.recordedBy !== undefined) {
    fields.push('recorded_by = ?');
    values.push(updates.recordedBy);
  }
  if (updates.deviceCalibrationId !== undefined) {
    fields.push('device_calibration_id = ?');
    values.push(updates.deviceCalibrationId);
  }
  if (updates.ticketId !== undefined) {
    fields.push('ticket_id = ?');
    values.push(updates.ticketId);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const update = db.prepare(`
    UPDATE sample_records SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getSampleRecordById(id);
}

export function getSampleRecordById(id: string): SampleRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sample_records WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToSampleRecord(row);
}

export function getSampleRecordsByPool(
  poolId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    sampleType?: SampleType;
    isExceeded?: boolean;
  }
): SampleRecord[] {
  const db = getDatabase();
  let query = 'SELECT * FROM sample_records WHERE pool_id = ?';
  const params: any[] = [poolId];

  if (options?.startDate) {
    query += ' AND sample_time >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND sample_time <= ?';
    params.push(options.endDate);
  }
  if (options?.sampleType) {
    query += ' AND sample_type = ?';
    params.push(options.sampleType);
  }
  if (options?.isExceeded !== undefined) {
    query += ' AND is_exceeded = ?';
    params.push(options.isExceeded ? 1 : 0);
  }

  query += ' ORDER BY sample_time DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToSampleRecord);
}

export function getSampleRecordsByStore(
  storeId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    sampleType?: SampleType;
    isExceeded?: boolean;
  }
): SampleRecord[] {
  const db = getDatabase();
  let query = 'SELECT * FROM sample_records WHERE store_id = ?';
  const params: any[] = [storeId];

  if (options?.startDate) {
    query += ' AND sample_time >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND sample_time <= ?';
    params.push(options.endDate);
  }
  if (options?.sampleType) {
    query += ' AND sample_type = ?';
    params.push(options.sampleType);
  }
  if (options?.isExceeded !== undefined) {
    query += ' AND is_exceeded = ?';
    params.push(options.isExceeded ? 1 : 0);
  }

  query += ' ORDER BY sample_time DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToSampleRecord);
}

export function getExceededSampleRecordsWithoutTicket(
  poolId: string,
  sampleType: SampleType
): SampleRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM sample_records 
    WHERE pool_id = ? AND sample_type = ? AND is_exceeded = 1 AND ticket_id IS NULL
    ORDER BY sample_time DESC
  `).all(poolId, sampleType);
  return rows.map(mapRowToSampleRecord);
}

export function getSampleRecordsByUser(
  user: User,
  options?: {
    startDate?: string;
    endDate?: string;
    sampleType?: SampleType;
    isExceeded?: boolean;
  }
): SampleRecord[] {
  const db = getDatabase();
  
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
    let query = `
      SELECT sr.* FROM sample_records sr
      JOIN stores s ON sr.store_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.startDate) {
      query += ' AND sr.sample_time >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      query += ' AND sr.sample_time <= ?';
      params.push(options.endDate);
    }
    if (options?.sampleType) {
      query += ' AND sr.sample_type = ?';
      params.push(options.sampleType);
    }
    if (options?.isExceeded !== undefined) {
      query += ' AND sr.is_exceeded = ?';
      params.push(options.isExceeded ? 1 : 0);
    }

    query += ' ORDER BY sr.sample_time DESC';

    const rows = db.prepare(query).all(...params);
    return rows.map(mapRowToSampleRecord);
  }
  
  if (user.storeId) {
    return getSampleRecordsByStore(user.storeId, options);
  }
  
  return [];
}

export function deleteSampleRecord(id: string, deletedBy: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM sample_records WHERE id = ?').run(id);
  return result.changes > 0;
}
