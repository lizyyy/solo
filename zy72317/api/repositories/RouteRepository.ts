import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { PickingRoute, RouteStatus, RouteOptimizationResult, ChangeRecord, ActionType, GapReviewInfo, GapBasicInfo } from '../../shared/types';
import { STATUS_LABELS } from '../../shared/types';
import { gapRecordRepository } from './GapRecordRepository';

export const VIRTUAL_SUPPLEMENT_BATCH_ID = 'virtual-supplement-batch';

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

  updateGapReviewInfo(id: string, gapReviewInfo: GapReviewInfo, operator: string): PickingRoute | null {
    const route = this.findById(id);
    if (!route) return null;

    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'gap_review',
      beforeValue: { status: route.status, gapReviewInfo: route.gapReviewInfo },
      afterValue: { status: 'reviewed_resolved', gapReviewInfo },
      remark: gapReviewInfo.resolutionRemark,
    };

    const newChangeLog = [...route.changeLog, changeRecord];
    const newStatus: RouteStatus = 'reviewed_resolved';
    const stmt = db.prepare(`
      UPDATE picking_route 
      SET status = ?, change_log = ?, gap_review_info = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(newStatus, JSON.stringify(newChangeLog), JSON.stringify(gapReviewInfo), id);

    const insertLogStmt = db.prepare(`
      INSERT INTO change_log (id, route_id, operator, action, before_value, after_value, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertLogStmt.run(
      uuidv4(),
      id,
      operator,
      'gap_review',
      JSON.stringify({ status: route.status, gapReviewInfo: route.gapReviewInfo }),
      JSON.stringify({ status: newStatus, gapReviewInfo }),
      gapReviewInfo.resolutionRemark
    );

    return this.findById(id);
  }

  logicalDelete(id: string, operator: string): PickingRoute | null {
    const route = this.findById(id);
    if (!route) return null;

    const beforeSnap = {
      id: route.id,
      currentLineNo: route.currentLineNo,
      originalLineNo: route.originalLineNo,
      orderNo: route.routeData.orderNo,
      sku: route.routeData.sku,
      status: route.status,
      routeData: route.routeData,
    };
    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'delete',
      beforeValue: beforeSnap,
      afterValue: null,
      remark: `人工删除行，原始行号=${route.originalLineNo}，当前编号=${route.currentLineNo}`,
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
      JSON.stringify(beforeSnap),
      null,
      `人工删除行，原始行号=${route.originalLineNo}，当前编号=${route.currentLineNo}`
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
    const sourceBatch = VIRTUAL_SUPPLEMENT_BATCH_ID;

    const changeRecord: ChangeRecord = {
      timestamp: new Date().toISOString(),
      operator,
      action: 'supplement',
      beforeValue: null,
      afterValue: { ...routeData, currentLineNo, originalLineNo },
      remark: `人工补录行，原始行号标记为-1表示补录，当前编号=${currentLineNo}`,
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
      JSON.stringify({ ...routeData, currentLineNo, originalLineNo }),
      `人工补录行，原始行号标记为-1表示补录，当前编号=${currentLineNo}`
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
      afterValue: { ...newRouteData },
      remark: '补录后重算拣货路线参数',
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
      JSON.stringify({ ...route.routeData }),
      JSON.stringify({ ...newRouteData }),
      '补录后重算拣货路线参数'
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

  countSupplementPendingRecalc(): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM picking_route 
      WHERE status = 'supplement_pending_recalc'
    `);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  detectAndCreateGapRecords(operator: string): { gapCount: number; gaps: GapBasicInfo[] } {
    const routes = this.findAll(false);
    const activeRoutes = routes.filter(r => r.status !== 'deleted');

    gapRecordRepository.closeAllOpenGaps();

    const byBatch = new Map<string, typeof activeRoutes>();
    for (const r of activeRoutes) {
      if (!byBatch.has(r.sourceBatch)) byBatch.set(r.sourceBatch, []);
      byBatch.get(r.sourceBatch)!.push(r);
    }

    const gaps: GapBasicInfo[] = [];

    for (const batchRoutes of byBatch.values()) {
      batchRoutes.sort((a, b) => a.currentLineNo - b.currentLineNo);
      for (let i = 0; i < batchRoutes.length - 1; i++) {
        const current = batchRoutes[i];
        const next = batchRoutes[i + 1];
        const expectedNext = current.currentLineNo + 1;

        if (next.currentLineNo > expectedNext) {
          const missingCount = next.currentLineNo - expectedNext;
          const gapRecord = gapRecordRepository.create(
            current.currentLineNo,
            next.currentLineNo,
            missingCount,
            current.id,
            next.id
          );
          gaps.push({
            gapId: gapRecord.id,
            beforeLineNo: current.currentLineNo,
            afterLineNo: next.currentLineNo,
            missingCount,
            beforeRouteId: current.id,
            afterRouteId: next.id,
          });
        }
      }
    }

    return {
      gapCount: gaps.length,
      gaps,
    };
  }

  private mapToModel(row: any): PickingRoute {
    const routeData = JSON.parse(row.route_data) as RouteOptimizationResult;
    const changeLog = JSON.parse(row.change_log) as ChangeRecord[];
    const status = row.status as RouteStatus;
    const gapReviewInfo = row.gap_review_info ? JSON.parse(row.gap_review_info) : null;

    return {
      id: row.id,
      originalLineNo: row.original_line_no,
      currentLineNo: row.current_line_no,
      routeData,
      status,
      statusLabel: STATUS_LABELS[status] || status,
      sourceBatch: row.source_batch,
      operator: row.operator,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      changeLog,
      gapReviewInfo,
    };
  }
}

export const routeRepository = new RouteRepository();
