const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { FREEZE_STATUS, canTransition, isTerminalStatus } = require('./FreezeStatusMachine');

class BudgetFreezeService {
  async createFreezeRecord(data) {
    const freezeId = uuidv4();
    const operationId = uuidv4();

    await db.run(`
      INSERT INTO budget_freezes (
        freeze_id, account_id, group_id, freeze_amount, freeze_reason,
        freeze_category, complaint_id, operator_id, operator_name,
        status, original_request, processing_basis, final_conclusion,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      freezeId, data.accountId, data.groupId || null, data.freezeAmount,
      data.freezeReason, data.freezeCategory, data.complaintId || null,
      data.operatorId, data.operatorName, FREEZE_STATUS.PENDING_REVIEW,
      JSON.stringify(data.originalRequest || {}),
      JSON.stringify(data.processingBasis || {}),
      null
    ]);

    await db.run(`
      INSERT INTO freeze_operations (
        operation_id, freeze_id, operation_type, from_status, to_status,
        operator_id, operator_name, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      operationId, freezeId, 'create', null, FREEZE_STATUS.PENDING_REVIEW,
      data.operatorId, data.operatorName, '创建预算冻结记录'
    ]);

    return this.getFreezeRecord(freezeId);
  }

  async getFreezeRecord(freezeId) {
    const freeze = await db.get(`
      SELECT * FROM budget_freezes WHERE freeze_id = ?
    `, [freezeId]);

    if (!freeze) return null;

    const operations = await db.all(`
      SELECT * FROM freeze_operations WHERE freeze_id = ? ORDER BY created_at ASC
    `, [freezeId]);

    const approvals = await db.all(`
      SELECT * FROM thaw_approvals WHERE freeze_id = ? ORDER BY created_at ASC
    `, [freezeId]);

    const corrections = await db.all(`
      SELECT * FROM manual_corrections WHERE freeze_id = ? ORDER BY created_at ASC
    `, [freezeId]);

    return {
      ...freeze,
      operations,
      approvals,
      corrections
    };
  }

  async listFreezeRecords(filters = {}) {
    let sql = `SELECT * FROM budget_freezes WHERE 1=1`;
    const params = [];

    if (filters.accountId) {
      sql += ` AND account_id = ?`;
      params.push(filters.accountId);
    }
    if (filters.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters.complaintId) {
      sql += ` AND complaint_id = ?`;
      params.push(filters.complaintId);
    }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET ?`;
      params.push(filters.offset);
    }

    return db.all(sql, params);
  }

  async transitionStatus(freezeId, toStatus, operatorId, operatorName, remarks = '') {
    const freeze = await this.getFreezeRecord(freezeId);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    if (isTerminalStatus(freeze.status)) {
      throw new Error('当前状态为终态，不可转换');
    }

    if (!canTransition(freeze.status, toStatus)) {
      throw new Error(`不允许从 ${freeze.status} 转换到 ${toStatus}`);
    }

    const operationId = uuidv4();

    await db.run(`
      UPDATE budget_freezes
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE freeze_id = ?
    `, [toStatus, freezeId]);

    await db.run(`
      INSERT INTO freeze_operations (
        operation_id, freeze_id, operation_type, from_status, to_status,
        operator_id, operator_name, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      operationId, freezeId, 'status_transition', freeze.status, toStatus,
      operatorId, operatorName, remarks
    ]);

    return this.getFreezeRecord(freezeId);
  }

  async confirmFreeze(freezeId, operatorId, operatorName, processingBasis = {}) {
    const result = await this.transitionStatus(
      freezeId, FREEZE_STATUS.CONFIRMED, operatorId, operatorName,
      '客服主管确认冻结，进入正式排查流程'
    );

    await db.run(`
      UPDATE budget_freezes
      SET processing_basis = ?, updated_at = CURRENT_TIMESTAMP
      WHERE freeze_id = ?
    `, [JSON.stringify(processingBasis), freezeId]);

    return this.getFreezeRecord(freezeId);
  }

  async startInvestigation(freezeId, operatorId, operatorName) {
    return this.transitionStatus(
      freezeId, FREEZE_STATUS.IN_INVESTIGATION, operatorId, operatorName,
      '技术团队开始用量异常排查'
    );
  }

  async createThawApproval(freezeId, applicantId, applicantName, thawReason, proposedAmount) {
    const approvalId = uuidv4();

    await db.run(`
      INSERT INTO thaw_approvals (
        approval_id, freeze_id, applicant_id, applicant_name, thaw_reason,
        proposed_amount, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `, [
      approvalId, freezeId, applicantId, applicantName, thawReason, proposedAmount
    ]);

    return this.getFreezeRecord(freezeId);
  }

  async approveThaw(approvalId, approverId, approverName, approvalRemarks, isPartial = false) {
    const approval = await db.get(`
      SELECT * FROM thaw_approvals WHERE approval_id = ?
    `, [approvalId]);

    if (!approval) {
      throw new Error('审批记录不存在');
    }

    const toStatus = isPartial ? FREEZE_STATUS.PARTIALLY_THAWED : FREEZE_STATUS.THAWED;

    await db.run(`
      UPDATE thaw_approvals
      SET status = 'approved', approver_id = ?, approver_name = ?,
          approval_remarks = ?, approved_at = CURRENT_TIMESTAMP
      WHERE approval_id = ?
    `, [approverId, approverName, approvalRemarks, approvalId]);

    await this.transitionStatus(
      approval.freeze_id, toStatus, approverId, approverName,
      isPartial ? '部分解冻审批通过' : '全额解冻审批通过'
    );

    if (!isPartial) {
      await db.run(`
        UPDATE budget_freezes
        SET final_conclusion = ?, updated_at = CURRENT_TIMESTAMP
        WHERE freeze_id = ?
      `, [JSON.stringify({ conclusion: '全额解冻', amount: approval.proposed_amount }), approval.freeze_id]);
    }

    return this.getFreezeRecord(approval.freeze_id);
  }

  async rejectThaw(approvalId, approverId, approverName, rejectionReason) {
    const approval = await db.get(`
      SELECT * FROM thaw_approvals WHERE approval_id = ?
    `, [approvalId]);

    if (!approval) {
      throw new Error('审批记录不存在');
    }

    await db.run(`
      UPDATE thaw_approvals
      SET status = 'rejected', approver_id = ?, approver_name = ?,
          approval_remarks = ?, approved_at = CURRENT_TIMESTAMP
      WHERE approval_id = ?
    `, [approverId, approverName, rejectionReason, approvalId]);

    return this.getFreezeRecord(approval.freeze_id);
  }

  async createManualCorrection(data) {
    const correctionId = uuidv4();

    await db.run(`
      INSERT INTO manual_corrections (
        correction_id, freeze_id, account_id, group_id, correction_type,
        original_value, corrected_value, reason, operator_id, operator_name,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `, [
      correctionId, data.freezeId || null, data.accountId, data.groupId || null,
      data.correctionType, data.originalValue, data.correctedValue,
      data.reason, data.operatorId, data.operatorName
    ]);

    return { correctionId, ...data };
  }

  async approveCorrection(correctionId, approverId, approverName, remarks = '') {
    const correction = await db.get(`
      SELECT * FROM manual_corrections WHERE correction_id = ?
    `, [correctionId]);

    if (!correction) {
      throw new Error('修正记录不存在');
    }

    await db.run(`
      UPDATE manual_corrections
      SET status = 'approved', approver_id = ?, approver_name = ?
      WHERE correction_id = ?
    `, [approverId, approverName, correctionId]);

    if (correction.freeze_id) {
      await this.transitionStatus(
        correction.freeze_id, FREEZE_STATUS.CORRECTED, approverId, approverName,
        `人工修正已应用: ${remarks}`
      );

      await db.run(`
        UPDATE budget_freezes
        SET final_conclusion = ?, updated_at = CURRENT_TIMESTAMP
        WHERE freeze_id = ?
      `, [JSON.stringify({
        conclusion: '人工修正',
        correctionId,
        originalValue: correction.original_value,
        correctedValue: correction.corrected_value
      }), correction.freeze_id]);
    }

    return correction;
  }

  async handleException(freezeId, exceptionData, operatorId, operatorName) {
    const freeze = await db.get(`
      SELECT * FROM budget_freezes WHERE freeze_id = ?
    `, [freezeId]);

    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    const operationId = uuidv4();

    await db.run(`
      INSERT INTO freeze_operations (
        operation_id, freeze_id, operation_type, from_status, to_status,
        operator_id, operator_name, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      operationId, freezeId, 'exception', freeze.status, freeze.status,
      operatorId, operatorName,
      `异常处理: ${JSON.stringify(exceptionData)}`
    ]);

    await db.run(`
      UPDATE budget_freezes
      SET processing_basis = JSON_INSERT(processing_basis, '$.exception', ?)
      WHERE freeze_id = ?
    `, [JSON.stringify(exceptionData), freezeId]);

    return this.getFreezeRecord(freezeId);
  }

  async getExportData(filters = {}) {
    let sql = `
      SELECT
        bf.freeze_id,
        bf.account_id,
        ca.customer_name,
        ca.email as customer_email,
        bf.group_id,
        ag.group_name,
        bf.freeze_amount,
        bf.freeze_reason,
        bf.freeze_category,
        bf.complaint_id,
        bf.status,
        bf.operator_name as create_operator,
        bf.created_at,
        bf.updated_at,
        bf.original_request,
        bf.processing_basis,
        bf.final_conclusion
      FROM budget_freezes bf
      LEFT JOIN customer_accounts ca ON bf.account_id = ca.account_id
      LEFT JOIN api_groups ag ON bf.group_id = ag.group_id
      WHERE 1=1
    `;

    const params = [];

    if (filters.startDate) {
      sql += ` AND bf.created_at >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND bf.created_at <= ?`;
      params.push(filters.endDate);
    }
    if (filters.status) {
      sql += ` AND bf.status = ?`;
      params.push(filters.status);
    }
    if (filters.accountId) {
      sql += ` AND bf.account_id = ?`;
      params.push(filters.accountId);
    }

    sql += ` ORDER BY bf.created_at DESC`;

    const records = await db.all(sql, params);

    for (const record of records) {
      if (record.original_request) {
        record.original_request = JSON.parse(record.original_request);
      }
      if (record.processing_basis) {
        record.processing_basis = JSON.parse(record.processing_basis);
      }
      if (record.final_conclusion) {
        record.final_conclusion = JSON.parse(record.final_conclusion);
      }

      record.operations = await db.all(`
        SELECT operation_type, from_status, to_status, operator_name, remarks, created_at
        FROM freeze_operations
        WHERE freeze_id = ?
        ORDER BY created_at ASC
      `, [record.freeze_id]);

      record.approvals = await db.all(`
        SELECT applicant_name, thaw_reason, proposed_amount, approver_name,
               approval_remarks, status, created_at
        FROM thaw_approvals
        WHERE freeze_id = ?
        ORDER BY created_at ASC
      `, [record.freeze_id]);
    }

    return records;
  }

  async getUsageSummary(accountId, groupId = null, startDate, endDate) {
    let sql = `
      SELECT
        report_date,
        SUM(total_calls) as total_calls,
        SUM(total_cost) as total_cost,
        SUM(frozen_amount) as frozen_amount,
        SUM(available_budget) as available_budget
      FROM usage_reports
      WHERE account_id = ?
    `;
    const params = [accountId];

    if (groupId) {
      sql += ` AND group_id = ?`;
      params.push(groupId);
    }
    if (startDate) {
      sql += ` AND report_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND report_date <= ?`;
      params.push(endDate);
    }

    sql += ` GROUP BY report_date ORDER BY report_date ASC`;

    return db.all(sql, params);
  }
}

module.exports = new BudgetFreezeService();
