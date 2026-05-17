const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Database = require('../utils/db');

const RISK_STATUSES = {
  REGISTERED: 'registered',
  IN_PROGRESS: 'in_progress',
  REVIEWING: 'reviewing',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

const STATUS_TRANSITIONS = {
  [RISK_STATUSES.REGISTERED]: [RISK_STATUSES.IN_PROGRESS, RISK_STATUSES.CANCELLED],
  [RISK_STATUSES.IN_PROGRESS]: [RISK_STATUSES.REVIEWING, RISK_STATUSES.CANCELLED],
  [RISK_STATUSES.REVIEWING]: [RISK_STATUSES.CLOSED, RISK_STATUSES.IN_PROGRESS, RISK_STATUSES.CANCELLED],
  [RISK_STATUSES.CLOSED]: [],
  [RISK_STATUSES.CANCELLED]: []
};

class RiskService {
  static async createRisk(data, createdBy) {
    const now = moment().toISOString();
    const riskId = uuidv4();

    const sql = `
      INSERT INTO risks (
        id, project_code, risk_description, owner, action_plan, 
        close_condition, status, report, created_by, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    await Database.run(sql, [
      riskId,
      data.project_code,
      data.risk_description,
      data.owner,
      data.action_plan || null,
      data.close_condition || null,
      RISK_STATUSES.REGISTERED,
      data.report || null,
      createdBy,
      now,
      now
    ]);

    await this._addStatusHistory(
      riskId,
      null,
      RISK_STATUSES.REGISTERED,
      'register',
      createdBy,
      now,
      '风险登记'
    );

    return this.getRiskById(riskId);
  }

  static async getRiskById(riskId) {
    const sql = 'SELECT * FROM risks WHERE id = ?';
    return Database.get(sql, [riskId]);
  }

  static async getRisks(filters = {}) {
    let sql = 'SELECT * FROM risks WHERE 1=1';
    const params = [];

    if (filters.project_code) {
      sql += ' AND project_code = ?';
      params.push(filters.project_code);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.owner) {
      sql += ' AND owner = ?';
      params.push(filters.owner);
    }

    sql += ' ORDER BY created_at DESC';

    return Database.all(sql, params);
  }

  static async getRiskHistory(riskId) {
    const sql = 'SELECT * FROM risk_status_history WHERE risk_id = ? ORDER BY action_at DESC';
    return Database.all(sql, [riskId]);
  }

  static async transitionStatus(riskId, toStatus, actionBy, comment, evidence) {
    const risk = await this.getRiskById(riskId);
    if (!risk) {
      throw new Error('风险记录不存在');
    }

    const allowedTransitions = STATUS_TRANSITIONS[risk.status];
    if (!allowedTransitions.includes(toStatus)) {
      throw new Error(`不允许从 ${risk.status} 状态转换到 ${toStatus} 状态`);
    }

    const now = moment().toISOString();
    const action = this._getTransitionAction(risk.status, toStatus);

    const updateSql = `
      UPDATE risks 
      SET status = ?, updated_at = ?, version = version + 1
      ${toStatus === RISK_STATUSES.CLOSED ? ', closed_at = ?, closed_by = ?, close_evidence = ?' : ''}
      WHERE id = ?
    `;

    const params = [toStatus, now, riskId];
    if (toStatus === RISK_STATUSES.CLOSED) {
      params.splice(2, 0, now, actionBy, evidence || comment || '');
    }

    await Database.run(updateSql, params);

    await this._addStatusHistory(
      riskId,
      risk.status,
      toStatus,
      action,
      actionBy,
      now,
      comment,
      evidence
    );

    return this.getRiskById(riskId);
  }

  static async manualCorrection(riskId, data, correctedBy) {
    const risk = await this.getRiskById(riskId);
    if (!risk) {
      throw new Error('风险记录不存在');
    }

    const now = moment().toISOString();
    const fields = [];
    const params = [];

    const allowedFields = ['project_code', 'risk_description', 'owner', 'action_plan', 'close_condition', 'report'];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }

    if (fields.length === 0) {
      throw new Error('没有提供需要修正的字段');
    }

    fields.push('updated_at = ?');
    params.push(now);
    fields.push('version = version + 1');

    params.push(riskId);

    const sql = `UPDATE risks SET ${fields.join(', ')} WHERE id = ?`;
    await Database.run(sql, params);

    await this._addStatusHistory(
      riskId,
      risk.status,
      risk.status,
      'manual_correction',
      correctedBy,
      now,
      `人工修正: ${JSON.stringify(data)}`
    );

    return this.getRiskById(riskId);
  }

  static async recordFailedOperation(operationType, riskId, originalInput, errorMessage, processingBasis) {
    const id = uuidv4();
    const now = moment().toISOString();

    const sql = `
      INSERT INTO failed_operations (
        id, operation_type, risk_id, original_input, error_message, 
        processing_basis, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await Database.run(sql, [
      id,
      operationType,
      riskId || null,
      JSON.stringify(originalInput),
      errorMessage,
      processingBasis ? JSON.stringify(processingBasis) : null,
      now
    ]);

    return this.getFailedOperationById(id);
  }

  static async getFailedOperationById(operationId) {
    const sql = 'SELECT * FROM failed_operations WHERE id = ?';
    return Database.get(sql, [operationId]);
  }

  static async getFailedOperations(filters = {}) {
    let sql = 'SELECT * FROM failed_operations WHERE 1=1';
    const params = [];

    if (filters.risk_id) {
      sql += ' AND risk_id = ?';
      params.push(filters.risk_id);
    }

    if (filters.operation_type) {
      sql += ' AND operation_type = ?';
      params.push(filters.operation_type);
    }

    if (filters.resolved !== undefined) {
      if (filters.resolved) {
        sql += ' AND resolved_at IS NOT NULL';
      } else {
        sql += ' AND resolved_at IS NULL';
      }
    }

    sql += ' ORDER BY created_at DESC';

    return Database.all(sql, params);
  }

  static async resolveFailedOperation(operationId, resolvedBy, resolutionNotes, finalConclusion) {
    const now = moment().toISOString();

    const sql = `
      UPDATE failed_operations 
      SET resolved_at = ?, resolved_by = ?, resolution_notes = ?, final_conclusion = ?
      WHERE id = ?
    `;

    await Database.run(sql, [now, resolvedBy, resolutionNotes, finalConclusion || resolutionNotes, operationId]);
    return this.getFailedOperationById(operationId);
  }

  static async exportRisks(filters = {}) {
    const risks = await this.getRisks(filters);
    
    for (const risk of risks) {
      risk.history = await this.getRiskHistory(risk.id);
    }

    return risks;
  }

  static async _addStatusHistory(riskId, fromStatus, toStatus, action, actionBy, actionAt, comment, evidence) {
    const id = uuidv4();
    const sql = `
      INSERT INTO risk_status_history (
        id, risk_id, from_status, to_status, action, action_by, 
        action_at, comment, evidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return Database.run(sql, [
      id,
      riskId,
      fromStatus,
      toStatus,
      action,
      actionBy,
      actionAt,
      comment || null,
      evidence || null
    ]);
  }

  static _getTransitionAction(fromStatus, toStatus) {
    const actionMap = {
      [`${RISK_STATUSES.REGISTERED}_${RISK_STATUSES.IN_PROGRESS}`]: 'start_processing',
      [`${RISK_STATUSES.IN_PROGRESS}_${RISK_STATUSES.REVIEWING}`]: 'submit_for_review',
      [`${RISK_STATUSES.REVIEWING}_${RISK_STATUSES.CLOSED}`]: 'close',
      [`${RISK_STATUSES.REVIEWING}_${RISK_STATUSES.IN_PROGRESS}`]: 'rework',
      [`${RISK_STATUSES.REGISTERED}_${RISK_STATUSES.CANCELLED}`]: 'cancel',
      [`${RISK_STATUSES.IN_PROGRESS}_${RISK_STATUSES.CANCELLED}`]: 'cancel',
      [`${RISK_STATUSES.REVIEWING}_${RISK_STATUSES.CANCELLED}`]: 'cancel'
    };

    return actionMap[`${fromStatus}_${toStatus}`] || 'transition';
  }

  static getStatuses() {
    return RISK_STATUSES;
  }

  static getStatusTransitions() {
    return STATUS_TRANSITIONS;
  }
}

module.exports = RiskService;
