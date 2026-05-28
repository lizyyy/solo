import db from '../db/index';
import type { BusinessCase, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'business_case';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, buyer_name, seller_name, total_amount, financing_amount,
    current_status, overdue_days, risk_level, created_at, updated_at
  ) VALUES (
    @id, @businessNo, @buyerName, @sellerName, @totalAmount, @financingAmount,
    @currentStatus, @overdueDays, @riskLevel, @createdAt, @updatedAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    buyer_name = COALESCE(@buyerName, buyer_name),
    seller_name = COALESCE(@sellerName, seller_name),
    total_amount = COALESCE(@totalAmount, total_amount),
    financing_amount = COALESCE(@financingAmount, financing_amount),
    current_status = COALESCE(@currentStatus, current_status),
    overdue_days = COALESCE(@overdueDays, overdue_days),
    risk_level = COALESCE(@riskLevel, risk_level),
    updated_at = @updatedAt
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const CaseDAO = {
  async getById(id: string): Promise<BusinessCase | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<BusinessCase>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<BusinessCase>> {
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
      list: rows.map(row => toCamelCase<BusinessCase>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<BusinessCase> & { id: string }): Promise<BusinessCase> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      buyerName: data.buyerName,
      sellerName: data.sellerName,
      totalAmount: data.totalAmount,
      financingAmount: data.financingAmount,
      currentStatus: data.currentStatus || 'pending',
      overdueDays: data.overdueDays || 0,
      riskLevel: data.riskLevel || 'medium',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    createStmt.run(params);

    const result = await CaseDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<BusinessCase>): Promise<BusinessCase | null> {
    const now = new Date().toISOString();
    const params = {
      id,
      businessNo: data.businessNo,
      buyerName: data.buyerName,
      sellerName: data.sellerName,
      totalAmount: data.totalAmount,
      financingAmount: data.financingAmount,
      currentStatus: data.currentStatus,
      overdueDays: data.overdueDays,
      riskLevel: data.riskLevel,
      updatedAt: now,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return CaseDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<BusinessCase | null> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo LIMIT 1
    `);
    const row = stmt.get({ businessNo });
    return row ? toCamelCase<BusinessCase>(row as Record<string, any>) : null;
  },

  async updateStatus(businessNo: string, status: string, riskLevel?: string): Promise<void> {
    const stmt = db.prepare(`
      UPDATE ${TABLE_NAME} 
      SET current_status = @status, 
          risk_level = COALESCE(@riskLevel, risk_level), 
          updated_at = @updatedAt
      WHERE business_no = @businessNo
    `);
    stmt.run({
      businessNo,
      status,
      riskLevel: riskLevel || null,
      updatedAt: new Date().toISOString()
    });
  },

  async getStats(): Promise<{
    totalCases: number;
    overdueCases: number;
    totalAmount: number;
    overdueAmount: number;
    highRiskCases: number;
    inCollectionCases: number;
  }> {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as totalCases,
        SUM(CASE WHEN current_status IN ('overdue', 'in_collection', 'legal_action', 're_overdue') THEN 1 ELSE 0 END) as overdueCases,
        SUM(total_amount) as totalAmount,
        SUM(CASE WHEN current_status IN ('overdue', 'in_collection', 'legal_action', 're_overdue') THEN total_amount ELSE 0 END) as overdueAmount,
        SUM(CASE WHEN risk_level IN ('high', 'critical') THEN 1 ELSE 0 END) as highRiskCases,
        SUM(CASE WHEN current_status = 'in_collection' THEN 1 ELSE 0 END) as inCollectionCases
      FROM ${TABLE_NAME}
    `);
    const row = stmt.get() as any;
    return {
      totalCases: row?.totalCases || 0,
      overdueCases: row?.overdueCases || 0,
      totalAmount: row?.totalAmount || 0,
      overdueAmount: row?.overdueAmount || 0,
      highRiskCases: row?.highRiskCases || 0,
      inCollectionCases: row?.inCollectionCases || 0
    };
  },

  async findAll(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<{ list: BusinessCase[]; total: number }> {
    const result = await CaseDAO.list(filters, page, pageSize);
    return {
      list: result.list,
      total: result.total
    };
  }
};

export default CaseDAO;
