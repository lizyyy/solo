import db from '../db/index';
import type { Confirmation, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'confirmation';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, confirm_date, confirm_amount, goods_received,
    quality_issue, quality_issue_desc, confirmer, is_withdrawn,
    withdraw_reason, withdraw_date, status, version, created_at, updated_at
  ) VALUES (
    @id, @businessNo, @confirmDate, @confirmAmount, @goodsReceived,
    @qualityIssue, @qualityIssueDesc, @confirmer, @isWithdrawn,
    @withdrawReason, @withdrawDate, @status, @version, @createdAt, @updatedAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    confirm_date = COALESCE(@confirmDate, confirm_date),
    confirm_amount = COALESCE(@confirmAmount, confirm_amount),
    goods_received = COALESCE(@goodsReceived, goods_received),
    quality_issue = COALESCE(@qualityIssue, quality_issue),
    quality_issue_desc = COALESCE(@qualityIssueDesc, quality_issue_desc),
    confirmer = COALESCE(@confirmer, confirmer),
    is_withdrawn = COALESCE(@isWithdrawn, is_withdrawn),
    withdraw_reason = COALESCE(@withdrawReason, withdraw_reason),
    withdraw_date = COALESCE(@withdrawDate, withdraw_date),
    status = COALESCE(@status, status),
    version = COALESCE(@version, version),
    updated_at = @updatedAt
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const ConfirmationDAO = {
  async getById(id: string): Promise<Confirmation | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<Confirmation>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<Confirmation>> {
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
      list: rows.map(row => toCamelCase<Confirmation>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<Confirmation> & { id: string }): Promise<Confirmation> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      confirmDate: data.confirmDate,
      confirmAmount: data.confirmAmount,
      goodsReceived: data.goodsReceived || false,
      qualityIssue: data.qualityIssue || false,
      qualityIssueDesc: data.qualityIssueDesc,
      confirmer: data.confirmer,
      isWithdrawn: data.isWithdrawn || false,
      withdrawReason: data.withdrawReason,
      withdrawDate: data.withdrawDate,
      status: data.status || 'pending',
      version: data.version || 1,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    createStmt.run(params);

    const result = await ConfirmationDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<Confirmation>): Promise<Confirmation | null> {
    const now = new Date().toISOString();
    const params = {
      id,
      businessNo: data.businessNo,
      confirmDate: data.confirmDate,
      confirmAmount: data.confirmAmount,
      goodsReceived: data.goodsReceived,
      qualityIssue: data.qualityIssue,
      qualityIssueDesc: data.qualityIssueDesc,
      confirmer: data.confirmer,
      isWithdrawn: data.isWithdrawn,
      withdrawReason: data.withdrawReason,
      withdrawDate: data.withdrawDate,
      status: data.status,
      version: data.version,
      updatedAt: now,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return ConfirmationDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<Confirmation[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY version DESC, created_at DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<Confirmation>(row));
  },

  async getMaxVersion(businessNo: string): Promise<number> {
    const stmt = db.prepare(`
      SELECT COALESCE(MAX(version), 0) as max_version FROM ${TABLE_NAME}
      WHERE business_no = @businessNo
    `);
    const row = stmt.get({ businessNo }) as { max_version: number };
    return row?.max_version || 0;
  },

  async batchCreate(rows: (Partial<Confirmation> & { id: string })[]): Promise<Confirmation[]> {
    const results: Confirmation[] = [];
    for (const row of rows) {
      const result = await ConfirmationDAO.create(row);
      results.push(result);
    }
    return results;
  }
};

export default ConfirmationDAO;
