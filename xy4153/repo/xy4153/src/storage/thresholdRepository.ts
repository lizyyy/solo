import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Threshold, SampleType, User } from '../types';

function mapRowToThreshold(row: any): Threshold {
  return {
    id: row.id,
    sampleType: row.sample_type as SampleType,
    minValue: row.min_value,
    maxValue: row.max_value,
    unit: row.unit,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createThreshold(
  sampleType: SampleType,
  minValue: number,
  maxValue: number,
  unit: string,
  description: string | undefined,
  createdBy: User
): Threshold {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO thresholds (id, sample_type, min_value, max_value, unit, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, sampleType, minValue, maxValue, unit, description, now, now);

  return {
    id,
    sampleType,
    minValue,
    maxValue,
    unit,
    description,
    createdAt: now,
    updatedAt: now
  };
}

export function updateThreshold(
  id: string,
  updates: Partial<{
    minValue: number;
    maxValue: number;
    unit: string;
    description: string;
  }>,
  updatedBy: User
): Threshold | null {
  const db = getDatabase();
  const existing = getThresholdById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.minValue !== undefined) {
    fields.push('min_value = ?');
    values.push(updates.minValue);
  }
  if (updates.maxValue !== undefined) {
    fields.push('max_value = ?');
    values.push(updates.maxValue);
  }
  if (updates.unit !== undefined) {
    fields.push('unit = ?');
    values.push(updates.unit);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const update = db.prepare(`
    UPDATE thresholds SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getThresholdById(id);
}

export function getThresholdById(id: string): Threshold | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM thresholds WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToThreshold(row);
}

export function getThresholdByType(sampleType: SampleType): Threshold | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM thresholds WHERE sample_type = ?').get(sampleType);
  
  if (!row) return null;
  return mapRowToThreshold(row);
}

export function getAllThresholds(): Threshold[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM thresholds').all();
  return rows.map(mapRowToThreshold);
}

export function isValueExceeded(sampleType: SampleType, value: number): boolean {
  const threshold = getThresholdByType(sampleType);
  if (!threshold) return false;
  return value < threshold.minValue || value > threshold.maxValue;
}
