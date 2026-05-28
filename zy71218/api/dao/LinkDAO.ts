import db from '../db/index';
import type { BusinessLink, PaginatedResponse } from '../../shared/types';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils';

const TABLE_NAME = 'business_link';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, source_id, source_type, target_id, target_type,
    link_type, confidence, created_at
  ) VALUES (
    @id, @sourceId, @sourceType, @targetId, @targetType,
    @linkType, @confidence, @createdAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    source_id = COALESCE(@sourceId, source_id),
    source_type = COALESCE(@sourceType, source_type),
    target_id = COALESCE(@targetId, target_id),
    target_type = COALESCE(@targetType, target_type),
    link_type = COALESCE(@linkType, link_type),
    confidence = COALESCE(@confidence, confidence)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const LinkDAO = {
  async getById(id: string): Promise<BusinessLink | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<BusinessLink>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<BusinessLink>> {
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
      list: rows.map(row => toCamelCase<BusinessLink>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<BusinessLink> & { id: string }): Promise<BusinessLink> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      sourceId: data.sourceId,
      sourceType: data.sourceType,
      targetId: data.targetId,
      targetType: data.targetType,
      linkType: data.linkType,
      confidence: data.confidence || 100,
      createdAt: data.createdAt || now,
    };

    createStmt.run(params);

    const result = await LinkDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<BusinessLink>): Promise<BusinessLink | null> {
    const params = {
      id,
      sourceId: data.sourceId,
      sourceType: data.sourceType,
      targetId: data.targetId,
      targetType: data.targetType,
      linkType: data.linkType,
      confidence: data.confidence,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return LinkDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<BusinessLink[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} 
      WHERE source_id = @businessNo OR target_id = @businessNo
      ORDER BY created_at DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<BusinessLink>(row));
  },

  async findBySource(sourceId: string, sourceType: string): Promise<BusinessLink[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} 
      WHERE source_id = @sourceId AND source_type = @sourceType
      ORDER BY created_at DESC
    `);
    const rows = stmt.all({ sourceId, sourceType }) as Record<string, any>[];
    return rows.map(row => toCamelCase<BusinessLink>(row));
  },

  async batchCreate(rows: (Partial<BusinessLink> & { id: string })[]): Promise<BusinessLink[]> {
    const results: BusinessLink[] = [];
    for (const row of rows) {
      const result = await LinkDAO.create(row);
      results.push(result);
    }
    return results;
  },

  async getLinkGraph(businessNo: string): Promise<{ nodes: any[]; links: any[] }> {
    const stmt = db.prepare(`
      SELECT bl.*,
             CASE 
               WHEN bl.source_type = 'case' THEN bc.business_no
               WHEN bl.source_type = 'invoice' THEN i.invoice_no
               WHEN bl.source_type = 'confirmation' THEN '确认-' || bl.source_id
               WHEN bl.source_type = 'contract' THEN fc.contract_no
               WHEN bl.source_type = 'repayment_plan' THEN '计划-' || bl.source_id
               ELSE bl.source_id
             END as source_name,
             CASE 
               WHEN bl.source_type = 'case' THEN bc.total_amount
               WHEN bl.source_type = 'invoice' THEN i.amount
               WHEN bl.source_type = 'confirmation' THEN c.confirm_amount
               WHEN bl.source_type = 'contract' THEN fc.financing_amount
               WHEN bl.source_type = 'repayment_plan' THEN rp.principal + rp.interest
               ELSE 0
             END as source_amount,
             CASE 
               WHEN bl.source_type = 'case' THEN bc.current_status
               WHEN bl.source_type = 'invoice' THEN i.status
               WHEN bl.source_type = 'confirmation' THEN c.status
               WHEN bl.source_type = 'contract' THEN fc.status
               WHEN bl.source_type = 'repayment_plan' THEN rp.status
               ELSE NULL
             END as source_status,
             CASE 
               WHEN bl.source_type = 'case' THEN bc.created_at
               WHEN bl.source_type = 'invoice' THEN i.issue_date
               WHEN bl.source_type = 'confirmation' THEN c.confirm_date
               WHEN bl.source_type = 'contract' THEN fc.start_date
               WHEN bl.source_type = 'repayment_plan' THEN rp.planned_date
               ELSE bl.created_at
             END as source_date,
             CASE 
               WHEN bl.target_type = 'case' THEN bc2.business_no
               WHEN bl.target_type = 'invoice' THEN i2.invoice_no
               WHEN bl.target_type = 'confirmation' THEN '确认-' || bl.target_id
               WHEN bl.target_type = 'contract' THEN fc2.contract_no
               WHEN bl.target_type = 'repayment_plan' THEN '计划-' || bl.target_id
               ELSE bl.target_id
             END as target_name,
             CASE 
               WHEN bl.target_type = 'case' THEN bc2.total_amount
               WHEN bl.target_type = 'invoice' THEN i2.amount
               WHEN bl.target_type = 'confirmation' THEN c2.confirm_amount
               WHEN bl.target_type = 'contract' THEN fc2.financing_amount
               WHEN bl.target_type = 'repayment_plan' THEN rp2.principal + rp2.interest
               ELSE 0
             END as target_amount,
             CASE 
               WHEN bl.target_type = 'case' THEN bc2.current_status
               WHEN bl.target_type = 'invoice' THEN i2.status
               WHEN bl.target_type = 'confirmation' THEN c2.status
               WHEN bl.target_type = 'contract' THEN fc2.status
               WHEN bl.target_type = 'repayment_plan' THEN rp2.status
               ELSE NULL
             END as target_status,
             CASE 
               WHEN bl.target_type = 'case' THEN bc2.created_at
               WHEN bl.target_type = 'invoice' THEN i2.issue_date
               WHEN bl.target_type = 'confirmation' THEN c2.confirm_date
               WHEN bl.target_type = 'contract' THEN fc2.start_date
               WHEN bl.target_type = 'repayment_plan' THEN rp2.planned_date
               ELSE bl.created_at
             END as target_date
      FROM business_link bl
      LEFT JOIN business_case bc ON bl.source_type = 'case' AND bl.source_id = bc.business_no
      LEFT JOIN invoice i ON bl.source_type = 'invoice' AND bl.source_id = i.id
      LEFT JOIN confirmation c ON bl.source_type = 'confirmation' AND bl.source_id = c.id
      LEFT JOIN factoring_contract fc ON bl.source_type = 'contract' AND bl.source_id = fc.id
      LEFT JOIN repayment_plan rp ON bl.source_type = 'repayment_plan' AND bl.source_id = rp.id
      LEFT JOIN business_case bc2 ON bl.target_type = 'case' AND bl.target_id = bc2.business_no
      LEFT JOIN invoice i2 ON bl.target_type = 'invoice' AND bl.target_id = i2.id
      LEFT JOIN confirmation c2 ON bl.target_type = 'confirmation' AND bl.target_id = c2.id
      LEFT JOIN factoring_contract fc2 ON bl.target_type = 'contract' AND bl.target_id = fc2.id
      LEFT JOIN repayment_plan rp2 ON bl.target_type = 'repayment_plan' AND bl.target_id = rp2.id
      WHERE bl.source_id = @businessNo OR bl.target_id = @businessNo
    `);
    
    const rows = stmt.all({ businessNo }) as any[];
    
    const nodesMap = new Map<string, any>();
    const links: any[] = [];
    
    rows.forEach(row => {
      const sourceNode = {
        id: row.sourceId,
        type: row.sourceType,
        name: row.source_name,
        amount: row.source_amount,
        status: row.source_status,
        date: row.source_date,
      };
      
      const targetNode = {
        id: row.targetId,
        type: row.targetType,
        name: row.target_name,
        amount: row.target_amount,
        status: row.target_status,
        date: row.target_date,
      };
      
      if (!nodesMap.has(sourceNode.id)) {
        nodesMap.set(sourceNode.id, sourceNode);
      }
      if (!nodesMap.has(targetNode.id)) {
        nodesMap.set(targetNode.id, targetNode);
      }
      
      links.push({
        source: row.sourceId,
        target: row.targetId,
        linkType: row.linkType,
        confidence: row.confidence,
      });
    });
    
    return {
      nodes: Array.from(nodesMap.values()),
      links,
    };
  },
};

export default LinkDAO;
