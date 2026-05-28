import db from '../db/index';
import type { AuditLog, PaginatedResponse } from '../../shared/types';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils';

const TABLE_NAME = 'audit_log';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, user_id, user_name, action, target_type,
    target_id, ip_address, user_agent, detail, timestamp
  ) VALUES (
    @id, @userId, @userName, @action, @targetType,
    @targetId, @ipAddress, @userAgent, @detail, @timestamp
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    user_id = COALESCE(@userId, user_id),
    user_name = COALESCE(@userName, user_name),
    action = COALESCE(@action, action),
    target_type = COALESCE(@targetType, target_type),
    target_id = COALESCE(@targetId, target_id),
    ip_address = COALESCE(@ipAddress, ip_address),
    user_agent = COALESCE(@userAgent, user_agent),
    detail = COALESCE(@detail, detail)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const AuditDAO = {
  async getById(id: string): Promise<AuditLog | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<AuditLog>(row as Record<string, any>) : null;
  },

  async findAll(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<AuditLog>> {
    return AuditDAO.list(filters, page, pageSize);
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<AuditLog>> {
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
      list: rows.map(row => toCamelCase<AuditLog>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<AuditLog> & { id: string }): Promise<AuditLog> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      userId: data.userId,
      userName: data.userName,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      detail: data.detail,
      timestamp: data.timestamp || now,
    };

    createStmt.run(params);

    const result = await AuditDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<AuditLog>): Promise<AuditLog | null> {
    const params = {
      id,
      userId: data.userId,
      userName: data.userName,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      detail: data.detail,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return AuditDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },
};

export default AuditDAO;
