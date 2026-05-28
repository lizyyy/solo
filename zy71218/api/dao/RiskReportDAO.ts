import db from '../db/index';
import type { RiskReport, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'risk_report';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, report_date, risk_level, analyst,
    key_findings, recommendations, created_at
  ) VALUES (
    @id, @businessNo, @reportDate, @riskLevel, @analyst,
    @keyFindings, @recommendations, @createdAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    report_date = COALESCE(@reportDate, report_date),
    risk_level = COALESCE(@riskLevel, risk_level),
    analyst = COALESCE(@analyst, analyst),
    key_findings = COALESCE(@keyFindings, key_findings),
    recommendations = COALESCE(@recommendations, recommendations)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const RiskReportDAO = {
  async getById(id: string): Promise<RiskReport | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<RiskReport>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<RiskReport>> {
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
      list: rows.map(row => toCamelCase<RiskReport>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<RiskReport> & { id: string }): Promise<RiskReport> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      reportDate: data.reportDate || now,
      riskLevel: data.riskLevel,
      analyst: data.analyst,
      keyFindings: data.keyFindings,
      recommendations: data.recommendations,
      createdAt: data.createdAt || now,
    };

    createStmt.run(params);

    const result = await RiskReportDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<RiskReport>): Promise<RiskReport | null> {
    const params = {
      id,
      businessNo: data.businessNo,
      reportDate: data.reportDate,
      riskLevel: data.riskLevel,
      analyst: data.analyst,
      keyFindings: data.keyFindings,
      recommendations: data.recommendations,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return RiskReportDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<RiskReport[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY report_date DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<RiskReport>(row));
  },

  async findLatestByBusinessNo(businessNo: string): Promise<RiskReport | null> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY report_date DESC LIMIT 1
    `);
    const row = stmt.get({ businessNo });
    return row ? toCamelCase<RiskReport>(row as Record<string, any>) : null;
  }
};

export default RiskReportDAO;
