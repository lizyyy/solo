import type { ListVersion, ListVersionStatus } from '../types';
import { runQuery, getQuery, allQuery } from '../db';
import { generateId, now, auditLog, snakeToCamel, snakeToCamelAll } from '../utils';

export const createListVersion = async (
  name: string,
  description: string,
  version: string,
  createdBy: string
): Promise<ListVersion> => {
  const id = generateId();
  const createdAt = now();
  
  await runQuery(
    `INSERT INTO list_versions (id, name, description, version, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    [id, name, description, version, createdBy, createdAt, createdAt]
  );

  await auditLog(
    'list_version_created',
    'list_version',
    id,
    createdBy,
    { name, description, version }
  );

  return getListVersionById(id);
};

export const getListVersionById = async (id: string): Promise<ListVersion> => {
  const row = await getQuery(`SELECT * FROM list_versions WHERE id = ?`, [id]);
  return snakeToCamel(row) as ListVersion;
};

export const getAllListVersions = async (status?: ListVersionStatus): Promise<ListVersion[]> => {
  let sql = `SELECT * FROM list_versions`;
  const params: any[] = [];
  
  if (status) {
    sql += ` WHERE status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC`;
  
  const rows = await allQuery(sql, params);
  return snakeToCamelAll(rows) as ListVersion[];
};

export const archiveListVersion = async (
  id: string,
  actor: string
): Promise<ListVersion> => {
  const updatedAt = now();
  
  await runQuery(
    `UPDATE list_versions SET status = 'archived', updated_at = ? WHERE id = ?`,
    [updatedAt, id]
  );

  await auditLog(
    'list_version_archived',
    'list_version',
    id,
    actor,
    { note: '名单版本已归档' }
  );

  return getListVersionById(id);
};

export const getActiveListVersions = (): Promise<ListVersion[]> =>
  getAllListVersions('active');
