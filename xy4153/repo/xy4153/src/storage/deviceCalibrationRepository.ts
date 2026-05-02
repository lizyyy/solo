import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { DeviceCalibration, User, UserRole } from '../types';

function mapRowToDeviceCalibration(row: any): DeviceCalibration {
  return {
    id: row.id,
    storeId: row.store_id,
    deviceName: row.device_name,
    deviceType: row.device_type,
    serialNumber: row.serial_number,
    calibrationDate: row.calibration_date,
    validUntil: row.valid_until,
    calibratedBy: row.calibrated_by,
    certificateUrl: row.certificate_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createDeviceCalibration(
  storeId: string,
  deviceName: string,
  deviceType: string,
  serialNumber: string,
  calibrationDate: string,
  validUntil: string,
  calibratedBy: string,
  certificateUrl: string | undefined,
  createdBy: User
): DeviceCalibration {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO device_calibrations (
      id, store_id, device_name, device_type, serial_number,
      calibration_date, valid_until, calibrated_by, certificate_url,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, storeId, deviceName, deviceType, serialNumber,
    calibrationDate, validUntil, calibratedBy, certificateUrl,
    now, now
  );

  return {
    id,
    storeId,
    deviceName,
    deviceType,
    serialNumber,
    calibrationDate,
    validUntil,
    calibratedBy,
    certificateUrl,
    createdAt: now,
    updatedAt: now
  };
}

export function updateDeviceCalibration(
  id: string,
  updates: Partial<{
    deviceName: string;
    deviceType: string;
    serialNumber: string;
    calibrationDate: string;
    validUntil: string;
    calibratedBy: string;
    certificateUrl: string;
  }>,
  updatedBy: User
): DeviceCalibration | null {
  const db = getDatabase();
  const existing = getDeviceCalibrationById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.deviceName !== undefined) {
    fields.push('device_name = ?');
    values.push(updates.deviceName);
  }
  if (updates.deviceType !== undefined) {
    fields.push('device_type = ?');
    values.push(updates.deviceType);
  }
  if (updates.serialNumber !== undefined) {
    fields.push('serial_number = ?');
    values.push(updates.serialNumber);
  }
  if (updates.calibrationDate !== undefined) {
    fields.push('calibration_date = ?');
    values.push(updates.calibrationDate);
  }
  if (updates.validUntil !== undefined) {
    fields.push('valid_until = ?');
    values.push(updates.validUntil);
  }
  if (updates.calibratedBy !== undefined) {
    fields.push('calibrated_by = ?');
    values.push(updates.calibratedBy);
  }
  if (updates.certificateUrl !== undefined) {
    fields.push('certificate_url = ?');
    values.push(updates.certificateUrl);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const update = db.prepare(`
    UPDATE device_calibrations SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getDeviceCalibrationById(id);
}

export function getDeviceCalibrationById(id: string): DeviceCalibration | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM device_calibrations WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToDeviceCalibration(row);
}

export function getDeviceCalibrationsByStore(storeId: string): DeviceCalibration[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM device_calibrations 
    WHERE store_id = ? 
    ORDER BY calibration_date DESC
  `).all(storeId);
  return rows.map(mapRowToDeviceCalibration);
}

export function getDeviceCalibrationsByUser(user: User): DeviceCalibration[] {
  const db = getDatabase();
  
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
    const rows = db.prepare(`
      SELECT dc.* FROM device_calibrations dc
      JOIN stores s ON dc.store_id = s.id
      ORDER BY s.name, dc.calibration_date DESC
    `).all();
    return rows.map(mapRowToDeviceCalibration);
  }
  
  if (user.storeId) {
    return getDeviceCalibrationsByStore(user.storeId);
  }
  
  return [];
}

export function getValidDeviceCalibrations(storeId: string, date: string): DeviceCalibration[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM device_calibrations 
    WHERE store_id = ? AND valid_until >= ?
    ORDER BY calibration_date DESC
  `).all(storeId, date);
  return rows.map(mapRowToDeviceCalibration);
}

export function isDeviceCalibrationValid(calibrationId: string, date: string): boolean {
  const calibration = getDeviceCalibrationById(calibrationId);
  if (!calibration) return false;
  return calibration.validUntil >= date;
}

export function deleteDeviceCalibration(id: string, deletedBy: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM device_calibrations WHERE id = ?').run(id);
  return result.changes > 0;
}
