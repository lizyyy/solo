import db from '../db/index';
import type { RepaymentPlan, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'repayment_plan';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, instalment_no, principal, interest,
    planned_date, status, version, created_at, updated_at
  ) VALUES (
    @id, @businessNo, @instalmentNo, @principal, @interest,
    @plannedDate, @status, @version, @createdAt, @updatedAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    instalment_no = COALESCE(@instalmentNo, instalment_no),
    principal = COALESCE(@principal, principal),
    interest = COALESCE(@interest, interest),
    planned_date = COALESCE(@plannedDate, planned_date),
    status = COALESCE(@status, status),
    version = COALESCE(@version, version),
    updated_at = @updatedAt
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const RepaymentPlanDAO = {
  async getById(id: string): Promise<RepaymentPlan | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<RepaymentPlan>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<RepaymentPlan>> {
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
      list: rows.map(row => toCamelCase<RepaymentPlan>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<RepaymentPlan> & { id: string }): Promise<RepaymentPlan> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      instalmentNo: data.instalmentNo,
      principal: data.principal,
      interest: data.interest,
      plannedDate: data.plannedDate,
      status: data.status || 'pending',
      version: data.version || 1,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    createStmt.run(params);

    const result = await RepaymentPlanDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<RepaymentPlan>): Promise<RepaymentPlan | null> {
    const now = new Date().toISOString();
    const params = {
      id,
      businessNo: data.businessNo,
      instalmentNo: data.instalmentNo,
      principal: data.principal,
      interest: data.interest,
      plannedDate: data.plannedDate,
      status: data.status,
      version: data.version,
      updatedAt: now,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return RepaymentPlanDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<RepaymentPlan[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY instalment_no ASC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<RepaymentPlan>(row));
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const stmt = db.prepare(`
      UPDATE ${TABLE_NAME} 
      SET status = @status, updated_at = @updatedAt
      WHERE id = @id
    `);
    stmt.run({
      id,
      status,
      updatedAt: new Date().toISOString()
    });
  },

  async batchCreate(rows: (Partial<RepaymentPlan> & { id: string })[]): Promise<RepaymentPlan[]> {
    const results: RepaymentPlan[] = [];
    for (const row of rows) {
      const result = await RepaymentPlanDAO.create(row);
      results.push(result);
    }
    return results;
  }
};

export default RepaymentPlanDAO;
