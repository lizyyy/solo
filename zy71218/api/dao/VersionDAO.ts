import db from '../db/index';
import type { VersionHistory, PaginatedResponse } from '../../shared/types';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils';

const TABLE_NAME = 'version_history';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, record_id, record_type, version, before_data,
    after_data, changed_fields, operator_id, operator_name, change_reason, timestamp
  ) VALUES (
    @id, @recordId, @recordType, @version, @beforeData,
    @afterData, @changedFields, @operatorId, @operatorName, @changeReason, @timestamp
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    record_id = COALESCE(@recordId, record_id),
    record_type = COALESCE(@recordType, record_type),
    version = COALESCE(@version, version),
    before_data = COALESCE(@beforeData, before_data),
    after_data = COALESCE(@afterData, after_data),
    changed_fields = COALESCE(@changedFields, changed_fields),
    operator_id = COALESCE(@operatorId, operator_id),
    operator_name = COALESCE(@operatorName, operator_name),
    change_reason = COALESCE(@changeReason, change_reason)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

const getMaxVersionStmt = db.prepare(`
  SELECT COALESCE(MAX(version), 0) as max_version FROM ${TABLE_NAME}
  WHERE record_id = @recordId AND record_type = @recordType
`);

const findByRecordStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME}
  WHERE record_id = @recordId AND record_type = @recordType
  ORDER BY version DESC
`);

const findByVersionStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME}
  WHERE record_id = @recordId AND record_type = @recordType AND version = @version
  LIMIT 1
`);

export const VersionDAO = {
  async getById(id: string): Promise<VersionHistory | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<VersionHistory>(row as Record<string, any>) : null;
  },

  async getMaxVersion(recordId: string, recordType: string): Promise<number> {
    const row = getMaxVersionStmt.get({ recordId, recordType }) as { max_version: number };
    return row?.max_version || 0;
  },

  async findByRecord(recordId: string, recordType: string): Promise<VersionHistory[]> {
    const rows = findByRecordStmt.all({ recordId, recordType }) as Record<string, any>[];
    return rows.map(row => toCamelCase<VersionHistory>(row));
  },

  async findByVersion(recordId: string, recordType: string, version: number): Promise<VersionHistory | null> {
    const row = findByVersionStmt.get({ recordId, recordType, version });
    return row ? toCamelCase<VersionHistory>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<VersionHistory>> {
    const { clause, params } = buildWhereClause(filters);
    
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const offset = (currentPage - 1) * currentPageSize;

    const countSql = buildCountSql(TABLE_NAME, clause);
    const listSql = buildSelectAllSql(TABLE_NAME, clause);

    const countRow = db.prepare(countSql).get(params) as { count: number };
    const rows = db.prepare(listSql).all({
      ...params,
      limit: currentPageSize,
      offset,
    }) as Record<string, any>[];

    return {
      list: rows.map(row => toCamelCase<VersionHistory>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<VersionHistory> & { id: string }): Promise<string> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      recordId: data.recordId,
      recordType: data.recordType,
      version: data.version || 1,
      beforeData: data.beforeData,
      afterData: data.afterData,
      changedFields: data.changedFields,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      changeReason: data.changeReason,
      timestamp: data.timestamp || now,
    };

    createStmt.run(params);

    return data.id;
  },

  async update(id: string, data: Partial<VersionHistory>): Promise<VersionHistory | null> {
    const params = {
      id,
      recordId: data.recordId,
      recordType: data.recordType,
      version: data.version,
      beforeData: data.beforeData,
      afterData: data.afterData,
      changedFields: data.changedFields,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      changeReason: data.changeReason,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return VersionDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },
};

export default VersionDAO;
