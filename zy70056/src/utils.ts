import { v4 as uuidv4 } from 'uuid';
import type { AuditActionType } from './types';
import { runQuery, getQuery, allQuery } from './db';

export const generateId = (): string => uuidv4();

export const now = (): string => new Date().toISOString();

export const auditLog = async (
  actionType: AuditActionType,
  entityType: 'list_version' | 'hit_record' | 'account_freeze',
  entityId: string,
  actor: string,
  details: Record<string, any>
): Promise<void> => {
  await runQuery(
    `INSERT INTO audit_logs (id, action_type, entity_type, entity_id, actor, details, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      actionType,
      entityType,
      entityId,
      actor,
      JSON.stringify(details),
      now()
    ]
  );
};

export const getAuditLogsByEntity = async (
  entityType: 'list_version' | 'hit_record' | 'account_freeze',
  entityId: string
): Promise<any[]> => {
  const logs = await allQuery(
    `SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC`,
    [entityType, entityId]
  );
  return logs.map(l => ({
    ...l,
    details: JSON.parse(l.details)
  }));
};

export const getEntityById = async (
  table: string,
  id: string
): Promise<any | null> => {
  return getQuery(`SELECT * FROM ${table} WHERE id = ?`, [id]);
};

export const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export const snakeToCamel = (row: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const key in row) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = row[key];
  }
  return result;
};

export const snakeToCamelAll = (rows: Record<string, any>[]): Record<string, any>[] =>
  rows.map(snakeToCamel);

export const parseDetails = (logs: any[]): any[] =>
  logs.map(l => ({
    ...l,
    details: typeof l.details === 'string' ? JSON.parse(l.details) : l.details
  }));
