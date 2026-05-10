const { runAsync, getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');
const { auditService, TABLE_NAMES } = require('./audit-service');

const milestoneService = {
  createMilestone: async (data) => {
    const result = await runAsync(
      `INSERT INTO milestones (project_id, name, description, amount, due_date) VALUES (?, ?, ?, ?, ?)`,
      [data.project_id, data.name, data.description || null, data.amount, data.due_date]
    );
    
    const createdMilestone = await getAsync('SELECT * FROM milestones WHERE id = ?', [result.lastID]);
    await auditService.logCreate(TABLE_NAMES.MILESTONES, result.lastID, data.user_id || 'system', createdMilestone);
    
    return createdMilestone;
  },

  getMilestonesByProject: async (projectId) => {
    return await allAsync(
      `SELECT * FROM milestones WHERE project_id = ? ORDER BY due_date ASC`,
      [projectId]
    );
  },

  getMilestoneById: async (id) => {
    return await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
  },

  updateMilestone: async (id, data) => {
    const oldMilestone = await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
    
    await runAsync(
      `UPDATE milestones SET name = ?, description = ?, amount = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [data.name, data.description || null, data.amount, data.due_date, id]
    );
    
    const updatedMilestone = await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
    await auditService.logUpdate(TABLE_NAMES.MILESTONES, id, data.user_id || 'system', oldMilestone, updatedMilestone);
    
    return updatedMilestone;
  },

  updateMilestoneStatus: async (id, status) => {
    await runAsync(
      `UPDATE milestones SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, id]
    );
    return await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
  },

  updateAcceptanceStatus: async (id, status) => {
    await runAsync(
      `UPDATE milestones SET acceptance_status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, id]
    );
    return await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
  },

  updateInvoiceStatus: async (id, status) => {
    await runAsync(
      `UPDATE milestones SET invoice_status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, id]
    );
    return await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
  },

  addCollectedAmount: async (id, amount) => {
    const currentMilestone = await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
    const newCollected = (currentMilestone.collected_amount || 0) + amount;
    
    let newStatus = currentMilestone.status;
    if (newCollected >= currentMilestone.amount) {
      newStatus = BUSINESS_RULES.MILESTONE_STATUS.PAID;
    }
    
    await runAsync(
      `UPDATE milestones SET collected_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
      [newCollected, newStatus, id]
    );
    return await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
  },

  deleteMilestone: async (id) => {
    return await runAsync('DELETE FROM milestones WHERE id = ?', [id]);
  },

  getMilestoneWithDetails: async (id) => {
    const milestone = await getAsync('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) return null;
    
    const acceptances = await allAsync(
      `SELECT * FROM acceptances WHERE milestone_id = ? ORDER BY created_at DESC`,
      [id]
    );
    
    const invoices = await allAsync(
      `SELECT * FROM invoices WHERE milestone_id = ? ORDER BY created_at DESC`,
      [id]
    );
    
    const progress = BUSINESS_RULES.calculatePaymentProgress(
      milestone.amount,
      milestone.collected_amount
    );
    
    return {
      ...milestone,
      acceptances,
      invoices,
      progress: Math.round(progress * 100) / 100
    };
  }
};

module.exports = milestoneService;
