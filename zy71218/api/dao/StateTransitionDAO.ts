import db from '../db/index';
import type { StateTransition, PaginatedResponse } from '../../shared/types.js';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils.js';

const TABLE_NAME = 'state_transition';

const getByIdStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE id = @id
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, business_no, from_status, to_status, transition_type,
    reason, impact_scope, next_step, operator_id, operator_name,
    timestamp
  ) VALUES (
    @id, @businessNo, @fromStatus, @toStatus, @transitionType,
    @reason, @impactScope, @nextStep, @operatorId, @operatorName,
    @timestamp
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    business_no = COALESCE(@businessNo, business_no),
    from_status = COALESCE(@fromStatus, from_status),
    to_status = COALESCE(@toStatus, to_status),
    transition_type = COALESCE(@transitionType, transition_type),
    reason = COALESCE(@reason, reason),
    impact_scope = COALESCE(@impactScope, impact_scope),
    next_step = COALESCE(@nextStep, next_step),
    operator_id = COALESCE(@operatorId, operator_id),
    operator_name = COALESCE(@operatorName, operator_name)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const StateTransitionDAO = {
  async getById(id: string): Promise<StateTransition | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<StateTransition>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<StateTransition>> {
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
      list: rows.map(row => toCamelCase<StateTransition>(row)),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<StateTransition> & { id: string }): Promise<StateTransition> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      businessNo: data.businessNo,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      transitionType: data.transitionType,
      reason: data.reason,
      impactScope: data.impactScope,
      nextStep: data.nextStep,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      timestamp: data.timestamp || now,
    };

    createStmt.run(params);

    const result = await StateTransitionDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<StateTransition>): Promise<StateTransition | null> {
    const params = {
      id,
      businessNo: data.businessNo,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      transitionType: data.transitionType,
      reason: data.reason,
      impactScope: data.impactScope,
      nextStep: data.nextStep,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return StateTransitionDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },

  async findByBusinessNo(businessNo: string): Promise<StateTransition[]> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY timestamp DESC
    `);
    const rows = stmt.all({ businessNo }) as Record<string, any>[];
    return rows.map(row => toCamelCase<StateTransition>(row));
  },

  async findLatestByBusinessNo(businessNo: string): Promise<StateTransition | null> {
    const stmt = db.prepare(`
      SELECT * FROM ${TABLE_NAME} WHERE business_no = @businessNo ORDER BY timestamp DESC LIMIT 1
    `);
    const row = stmt.get({ businessNo });
    return row ? toCamelCase<StateTransition>(row as Record<string, any>) : null;
  }
};

export default StateTransitionDAO;
