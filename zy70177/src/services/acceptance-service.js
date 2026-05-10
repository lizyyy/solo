const { runAsync, getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');
const milestoneService = require('./milestone-service');
const { auditService, TABLE_NAMES } = require('./audit-service');

const acceptanceService = {
  createAcceptance: async (data) => {
    const result = await runAsync(
      `INSERT INTO acceptances (milestone_id, user_id, remarks) VALUES (?, ?, ?)`,
      [data.milestone_id, data.user_id, data.remarks || null]
    );
    
    const createdAcceptance = await getAsync('SELECT * FROM acceptances WHERE id = ?', [result.lastID]);
    await auditService.logCreate(TABLE_NAMES.ACCEPTANCES, result.lastID, data.user_id, createdAcceptance);
    
    return createdAcceptance;
  },

  confirmAcceptance: async (acceptanceId, data) => {
    const acceptance = await getAsync('SELECT * FROM acceptances WHERE id = ?', [acceptanceId]);
    if (!acceptance) {
      throw new Error('验收记录不存在');
    }

    const oldAcceptance = { ...acceptance };
    
    await runAsync(
      `UPDATE acceptances SET status = ?, confirmed_by = ?, confirmed_at = datetime('now'), remarks = ? WHERE id = ?`,
      [BUSINESS_RULES.ACCEPTANCE_STATUS.CONFIRMED, data.confirmed_by, data.remarks || acceptance.remarks, acceptanceId]
    );

    await milestoneService.updateAcceptanceStatus(
      acceptance.milestone_id,
      BUSINESS_RULES.ACCEPTANCE_STATUS.CONFIRMED
    );

    await milestoneService.updateMilestoneStatus(
      acceptance.milestone_id,
      BUSINESS_RULES.MILESTONE_STATUS.ACCEPTED
    );

    const updatedAcceptance = await getAsync('SELECT * FROM acceptances WHERE id = ?', [acceptanceId]);
    await auditService.logConfirm(TABLE_NAMES.ACCEPTANCES, acceptanceId, data.confirmed_by, updatedAcceptance);
    
    return updatedAcceptance;
  },

  rejectAcceptance: async (acceptanceId, data) => {
    const acceptance = await getAsync('SELECT * FROM acceptances WHERE id = ?', [acceptanceId]);
    if (!acceptance) {
      throw new Error('验收记录不存在');
    }

    await runAsync(
      `UPDATE acceptances SET status = ?, confirmed_by = ?, confirmed_at = datetime('now'), rejection_reason = ? WHERE id = ?`,
      [BUSINESS_RULES.ACCEPTANCE_STATUS.REJECTED, data.confirmed_by, data.rejection_reason, acceptanceId]
    );

    await milestoneService.updateAcceptanceStatus(
      acceptance.milestone_id,
      BUSINESS_RULES.ACCEPTANCE_STATUS.REJECTED
    );

    await auditService.logReject(TABLE_NAMES.ACCEPTANCES, acceptanceId, data.confirmed_by, data.rejection_reason);
    
    return await getAsync('SELECT * FROM acceptances WHERE id = ?', [acceptanceId]);
  },

  getAcceptanceById: async (id) => {
    return await getAsync('SELECT * FROM acceptances WHERE id = ?', [id]);
  },

  getAcceptancesByMilestone: async (milestoneId) => {
    return await allAsync(
      `SELECT * FROM acceptances WHERE milestone_id = ? ORDER BY created_at DESC`,
      [milestoneId]
    );
  }
};

module.exports = acceptanceService;
