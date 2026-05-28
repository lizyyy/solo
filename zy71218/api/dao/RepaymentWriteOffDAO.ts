import db from '../db/index.js';
import type { RepaymentWriteOff, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'repayment_write_off';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, repayment_id, target_type, target_id, amount, created_at
  ) VALUES (
    @id, @repaymentId, @targetType, @targetId, @amount, @createdAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    repayment_id = COALESCE(@repaymentId, repayment_id),
    target_type = COALESCE(@targetType, target_type),
    target_id = COALESCE(@targetId, target_id),
    amount = COALESCE(@amount, amount)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const RepaymentWriteOffDAO = {
  async getById(id: string): Promise<RepaymentWriteOff | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<RepaymentWriteOff>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<RepaymentWriteOff>> {
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
      list: rows.map(row => toCamelCase<RepaymentWriteOff>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<RepaymentWriteOff> & { id: string }): Promise<RepaymentWriteOff> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      repaymentId: data.repaymentId,
      targetType: data.targetType,
      targetId: data.targetId,
      amount: data.amount,
      createdAt: data.createdAt || now,
    };

    createStmt.run(params);

    const result = await RepaymentWriteOffDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<RepaymentWriteOff>): Promise<RepaymentWriteOff | null> {
    const params = {
      id,
      repaymentId: data.repaymentId,
      targetType: data.targetType,
      targetId: data.targetId,
      amount: data.amount,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return RepaymentWriteOffDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByRepaymentId(repaymentId: string): Promise<RepaymentWriteOff[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE repayment_id = @repaymentId ORDER BY created_at DESC
    `);
    const rows = stmt.all({ repaymentId }) as Record<string, any>[];
    return rows.map(row => toCamelCase<RepaymentWriteOff>(row));
  },

  async batchCreate(rows: (Partial<RepaymentWriteOff> & { id: string })[]): Promise<RepaymentWriteOff[]> {
    const results: RepaymentWriteOff[] = [];
    for (const row of rows) {
      const result = await RepaymentWriteOffDAO.create(row);
      results.push(result);
    }
    return results;
  },

  async getTotalWriteOffAmount(repaymentId: string): Promise<number> {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM ${TABLE_NAME} WHERE repayment_id = @repaymentId
    `);
    const row = stmt.get({ repaymentId }) as { total: number };
    return row?.total || 0;
  }
};

export default RepaymentWriteOffDAO;
