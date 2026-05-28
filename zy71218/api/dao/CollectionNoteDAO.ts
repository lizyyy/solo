import db from '../db/index';
import type { CollectionNote, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'collection_note';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, collection_date, collector, collection_method,
    contact_person, contact_result, next_action, follow_up_date, created_at
  ) VALUES (
    @id, @businessNo, @collectionDate, @collector, @collectionMethod,
    @contactPerson, @contactResult, @nextAction, @followUpDate, @createdAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    collection_date = COALESCE(@collectionDate, collection_date),
    collector = COALESCE(@collector, collector),
    collection_method = COALESCE(@collectionMethod, collection_method),
    contact_person = COALESCE(@contactPerson, contact_person),
    contact_result = COALESCE(@contactResult, contact_result),
    next_action = COALESCE(@nextAction, next_action),
    follow_up_date = COALESCE(@followUpDate, follow_up_date)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const CollectionNoteDAO = {
  async getById(id: string): Promise<CollectionNote | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<CollectionNote>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<CollectionNote>> {
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
      list: rows.map(row => toCamelCase<CollectionNote>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<CollectionNote> & { id: string }): Promise<CollectionNote> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      collectionDate: data.collectionDate || now,
      collector: data.collector,
      collectionMethod: data.collectionMethod,
      contactPerson: data.contactPerson,
      contactResult: data.contactResult,
      nextAction: data.nextAction,
      followUpDate: data.followUpDate,
      createdAt: data.createdAt || now,
    };

    createStmt.run(params);

    const result = await CollectionNoteDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<CollectionNote>): Promise<CollectionNote | null> {
    const params = {
      id,
      businessNo: data.businessNo,
      collectionDate: data.collectionDate,
      collector: data.collector,
      collectionMethod: data.collectionMethod,
      contactPerson: data.contactPerson,
      contactResult: data.contactResult,
      nextAction: data.nextAction,
      followUpDate: data.followUpDate,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return CollectionNoteDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<CollectionNote[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY collection_date DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<CollectionNote>(row));
  }
};

export default CollectionNoteDAO;
