import db from '../db/index';
import type { FactoringContract, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'factoring_contract';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, contract_no, factoring_rate, financing_amount,
    start_date, end_date, status, version, created_at, updated_at
  ) VALUES (
    @id, @businessNo, @contractNo, @factoringRate, @financingAmount,
    @startDate, @endDate, @status, @version, @createdAt, @updatedAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    contract_no = COALESCE(@contractNo, contract_no),
    factoring_rate = COALESCE(@factoringRate, factoring_rate),
    financing_amount = COALESCE(@financingAmount, financing_amount),
    start_date = COALESCE(@startDate, start_date),
    end_date = COALESCE(@endDate, end_date),
    status = COALESCE(@status, status),
    version = COALESCE(@version, version),
    updated_at = @updatedAt
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const ContractDAO = {
  async getById(id: string): Promise<FactoringContract | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<FactoringContract>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<FactoringContract>> {
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
      list: rows.map(row => toCamelCase<FactoringContract>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<FactoringContract> & { id: string }): Promise<FactoringContract> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      contractNo: data.contractNo,
      factoringRate: data.factoringRate,
      financingAmount: data.financingAmount,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status || 'active',
      version: data.version || 1,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    createStmt.run(params);

    const result = await ContractDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<FactoringContract>): Promise<FactoringContract | null> {
    const now = new Date().toISOString();
    const params = {
      id,
      businessNo: data.businessNo,
      contractNo: data.contractNo,
      factoringRate: data.factoringRate,
      financingAmount: data.financingAmount,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      version: data.version,
      updatedAt: now,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return ContractDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<FactoringContract[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY created_at DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<FactoringContract>(row));
  },

  async batchCreate(rows: (Partial<FactoringContract> & { id: string })[]): Promise<FactoringContract[]> {
    const results: FactoringContract[] = [];
    for (const row of rows) {
      const result = await ContractDAO.create(row);
      results.push(result);
    }
    return results;
  }
};

export default ContractDAO;
