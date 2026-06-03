import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { PickingRoute, RouteStatus, RouteOptimizationResult, ChangeRecord, ActionType } from '../../shared/types';
import { STATUS_LABELS } from '../../shared/types';

export class RouteRepository {
  create(
    originalLineNo: number,
    currentLineNo: number,
    routeData: RouteOptimizationResult,
    sourceBatch: string,
    operator: string,
    initialChangeLog: ChangeRecord[]
  ): PickingRoute {
    const id = uuidv4();
    const status: RouteStatus = 'normal';
    const stmt = db.prepare(`
      INSERT INTO picking_route (id, original_line_no, current_line_no, route_data, status, source_batch, operator, change_log)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      originalLineNo,
      currentLineNo,
      JSON.stringify(routeData),
      status,
      sourceBatch,
      operator,
      JSON.stringify(initialChangeLog)
    );
    return this.findById(id) as PickingRoute;
  }

  findById(id: string): PickingRoute | null {
    const stmt = db.prepare('SELECT * FROM picking_route WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToModel(row) : null;
  }

  findAll(excludeDeleted: boolean = true): PickingRoute[] {
    let sql = 'SELECT * FROM picking_route';
    if (excludeDeleted) {
      sql += " WHERE status != 'deleted'";
    }
    sql += ' ORDER BY current_line_no ASC';
    const stmt = db.prepare(sql);
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapToModel(row));
  }

  findByBatch(batchId: string): PickingRoute[] {
    const stmt = db.prepare(`
      SELECT * FROM picking_route 
      WHERE source_batch = ? 
      ORDER BY current_line_no ASC
    `);
    const rows = stmt.all(batchId) as any[];
    return rows.map(row => this.mapToModel(row));
  }

  findMaxCurrentLineNo(): number {
    const stmt = db.prepare(`
      SELECT MAX(current_line_no) as max_no 
      FROM picking_route 
      WHERE status != 'deleted'
    `);
    const row = stmt.get() as { max_no: number | null };
    return row.max_no || 0;
  }

  updateStatus(id: string, status: RouteStatus, operator: string, remark: string): PickingRoute | null {
    const route = this.findById(id);
    if (!route) return null;

    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'status_update',
      beforeValue: route.status,
      afterValue: status,
      remark,
    };

    const newChangeLog = [...route.changeLog, changeRecord];
    const stmt = db.prepare(`
      UPDATE picking_route 
      SET status = ?, change_log = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, JSON.stringify(newChangeLog), id);

    const insertLogStmt = db.prepare(`
      INSERT INTO change_log (id, route_id, operator, action, before_value, after_value, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertLogStmt.run(
      uuidv4(),
      id,
      operator,
      'status_update',
      JSON.stringify(route.status),
      JSON.stringify(status),
      remark
    );

    return this.findById(id);
  }

  updateStatusForMultiple(ids: string[], status: RouteStatus, operator: string, remark: string): void {
    const stmt = db.prepare(`
      UPDATE picking_route 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertLogStmt = db.prepare(`
      INSERT INTO change_log (id, route_id, operator, action, before_value, after_value, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const id of ids) {
        const route = this.findById(id);
        if (!route) continue;

        const changeRecord: ChangeRecord = {
          timestamp: new Date().toISOString(),
          operator,
          action: 'status_update' as ActionType,
          beforeValue: route.status,
          afterValue: status,
          remark,
        };

        const newChangeLog = [...route.changeLog, changeRecord];

        db.prepare(`
          UPDATE picking_route 
          SET status = ?, change_log = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(status, JSON.stringify(newChangeLog), id);

        insertLogStmt.run(
          uuidv4(),
          id,
          operator,
          'status_update',
          JSON.stringify(route.status),
          JSON.stringify(status),
          remark
        );
      }
    });

    transaction();
  }

  logicalDelete(id: string, operator: string): PickingRoute | null {
    const route = this.findById(id);
    if (!route) return null;

    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'delete',
      beforeValue: { ...route.routeData },
      afterValue: null,
      remark: '人工删除行',
    };

    const newChangeLog = [...route.changeLog, changeRecord];
    const stmt = db.prepare(`
      UPDATE picking_route 
      SET status = 'deleted', change_log = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(newChangeLog), id);

    const insertLogStmt = db.prepare(`
      INSERT INTO change_log (id, route_id, operator, action, before_value, after_value, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertLogStmt.run(
      uuidv4(),
      id,
      operator,
      'delete',
      JSON.stringify(route.routeData),
      null,
      '人工删除行'
    );

    return this.findById(id);
  }

  supplement(
    routeData: RouteOptimizationResult,
    operator: string
  ): PickingRoute {
    const maxLineNo = this.findMaxCurrentLineNo();
    const currentLineNo = maxLineNo + 1;
    const originalLineNo = -1;
    const status: RouteStatus = 'supplement_pending_recalc';
    const sourceBatch = 'supplement';

    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'supplement',
      beforeValue: null,
      afterValue: routeData,
      remark: '人工补录行',
    };

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO picking_route (id, original_line_no, current_line_no, route_data, status, source_batch, operator, change_log)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      originalLineNo,
      currentLineNo,
      JSON.stringify(routeData),
      status,
      sourceBatch,
      operator,
      JSON.stringify([changeRecord])
    );

    const insertLogStmt = db.prepare(`
      INSERT INTO change_log (id, route_id, operator, action, before_value, after_value, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertLogStmt.run(
      uuidv4(),
      id,
      operator,
      'supplement',
      null,
      JSON.stringify(routeData),
      '人工补录行'
    );

    return this.findById(id) as PickingRoute;
  }

  recalculate(routeId: string, newRouteData: RouteOptimizationResult, operator: string): PickingRoute | null {
    const route = this.findById(routeId);
    if (!route) return null;

    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'recalculate',
      beforeValue: { ...route.routeData },
      afterValue: newRouteData,
      remark: '补录后重算',
    };

    const newChangeLog = [...route.changeLog, changeRecord];
    const newStatus: RouteStatus = 'normal';
    const stmt = db.prepare(`
      UPDATE picking_route 
      SET route_data = ?, status = ?, change_log = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(newRouteData), newStatus, JSON.stringify(newChangeLog), routeId);

    const insertLogStmt = db.prepare(`
      INSERT INTO change_log (id, route_id, operator, action, before_value, after_value, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertLogStmt.run(
      uuidv4(),
      routeId,
      operator,
      'recalculate',
      JSON.stringify(route.routeData),
      JSON.stringify(newRouteData),
      '补录后重算'
    );

    return this.findById(routeId);
  }

  count(): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM picking_route 
      WHERE status != 'deleted'
    `);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  private mapToModel(row: any): PickingRoute {
    const routeData = JSON.parse(row.route_data) as RouteOptimizationResult;
    const changeLog = JSON.parse(row.change_log) as ChangeRecord[];
    const status = row.status as RouteStatus;

    return {
      id: row.id,
      originalLineNo: row.original_line_no,
      currentLineNo: row.current_line_no,
      routeData,
      status,
      statusLabel: STATUS_LABELS[status],
      sourceBatch: row.source_batch,
      operator: row.operator,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      changeLog,
    };
  }
}

export const routeRepository = new RouteRepository();
