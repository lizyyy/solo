import db from '../db/index';
import type { Repayment, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'repayment';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, repayment_date, total_amount, principal_paid,
    interest_paid, penalty_paid, payer, remark, write_off_status, created_at
  ) VALUES (
    @id, @businessNo, @repaymentDate, @totalAmount, @principalPaid,
    @interestPaid, @penaltyPaid, @payer, @remark, @writeOffStatus, @createdAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    repayment_date = COALESCE(@repaymentDate, repayment_date),
    total_amount = COALESCE(@totalAmount, total_amount),
    principal_paid = COALESCE(@principalPaid, principal_paid),
    interest_paid = COALESCE(@interestPaid, interest_paid),
    penalty_paid = COALESCE(@penaltyPaid, penalty_paid),
    payer = COALESCE(@payer, payer),
    remark = COALESCE(@remark, remark),
    write_off_status = COALESCE(@writeOffStatus, write_off_status)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const RepaymentDAO = {
  async getById(id: string): Promise<Repayment | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<Repayment>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<Repayment>> {
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
      list: rows.map(row => toCamelCase<Repayment>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<Repayment> & { id: string }): Promise<Repayment> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      repaymentDate: data.repaymentDate || now,
      totalAmount: data.totalAmount,
      principalPaid: data.principalPaid || 0,
      interestPaid: data.interestPaid || 0,
      penaltyPaid: data.penaltyPaid || 0,
      payer: data.payer,
      remark: data.remark,
      writeOffStatus: data.writeOffStatus || 'pending',
      createdAt: data.createdAt || now,
    };

    createStmt.run(params);

    const result = await RepaymentDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<Repayment>): Promise<Repayment | null> {
    const params = {
      id,
      businessNo: data.businessNo,
      repaymentDate: data.repaymentDate,
      totalAmount: data.totalAmount,
      principalPaid: data.principalPaid,
      interestPaid: data.interestPaid,
      penaltyPaid: data.penaltyPaid,
      payer: data.payer,
      remark: data.remark,
      writeOffStatus: data.writeOffStatus,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return RepaymentDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findAll(filters?: Record<string, any>): Promise<Repayment[]> {
    const result = await RepaymentDAO.list(filters);
    return result.list;
  },

  async findByBusinessNo(businessNo: string): Promise<Repayment[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY repayment_date DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<Repayment>(row));
  },

  async updateWriteOffStatus(id: string, status: string): Promise<void> {
    const stmt = db.prepare(`
      UPDATE ${TABLE_NAME} 
      SET write_off_status = @status
      WHERE id = @id
    `);
    stmt.run({
      id,
      status,
    });
  }
};

export default RepaymentDAO;
