import db from '../db/index';
import type { Invoice, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'invoice';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, invoice_no, seller_name, amount,
    tax_amount, goods_description, issue_date, due_date,
    status, version, created_at, updated_at
  ) VALUES (
    @id, @businessNo, @invoiceNo, @sellerName, @amount,
    @taxAmount, @goodsDescription, @issueDate, @dueDate,
    @status, @version, @createdAt, @updatedAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    invoice_no = COALESCE(@invoiceNo, invoice_no),
    seller_name = COALESCE(@sellerName, seller_name),
    amount = COALESCE(@amount, amount),
    tax_amount = COALESCE(@taxAmount, tax_amount),
    goods_description = COALESCE(@goodsDescription, goods_description),
    issue_date = COALESCE(@issueDate, issue_date),
    due_date = COALESCE(@dueDate, due_date),
    status = COALESCE(@status, status),
    version = COALESCE(@version, version),
    updated_at = @updatedAt
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const InvoiceDAO = {
  async getById(id: string): Promise<Invoice | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<Invoice>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<Invoice>> {
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
      list: rows.map(row => toCamelCase<Invoice>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<Invoice> & { id: string }): Promise<Invoice> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      invoiceNo: data.invoiceNo,
      sellerName: data.sellerName,
      amount: data.amount,
      taxAmount: data.taxAmount,
      goodsDescription: data.goodsDescription,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      status: data.status || 'issued',
      version: data.version || 1,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    createStmt.run(params);

    const result = await InvoiceDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<Invoice>): Promise<Invoice | null> {
    const now = new Date().toISOString();
    const params = {
      id,
      businessNo: data.businessNo,
      invoiceNo: data.invoiceNo,
      sellerName: data.sellerName,
      amount: data.amount,
      taxAmount: data.taxAmount,
      goodsDescription: data.goodsDescription,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      status: data.status,
      version: data.version,
      updatedAt: now,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return InvoiceDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<Invoice[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY created_at DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<Invoice>(row));
  },

  async findByInvoiceNo(invoiceNo: string): Promise<Invoice | null> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE invoice_no = @invoiceNo LIMIT 1
    `);
    const row = stmt.get({ invoiceNo });
    return row ? toCamelCase<Invoice>(row as Record<string, any>) : null;
  },

  async batchCreate(rows: (Partial<Invoice> & { id: string })[]): Promise<Invoice[]> {
    const results: Invoice[] = [];
    for (const row of rows) {
      const result = await InvoiceDAO.create(row);
      results.push(result);
    }
    return results;
  }
};

export default InvoiceDAO;
