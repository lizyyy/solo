const { getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');

const alertService = {
  checkForOverdueMilestones: async () => {
    const milestones = await allAsync(`
      SELECT m.*, p.name as project_name, p.client as client_name
      FROM milestones m
      JOIN projects p ON m.project_id = p.id
      WHERE m.status NOT IN ('paid', 'invoiced')
      ORDER BY m.due_date ASC
    `);

    const overdueMilestones = [];
    
    milestones.forEach(milestone => {
      const isOverdue = BUSINESS_RULES.isMilestoneOverdue(milestone.due_date);
      if (isOverdue) {
        const overdueDays = BUSINESS_RULES.getOverdueDays(milestone.due_date);
        overdueMilestones.push({
          ...milestone,
          overdue_days: overdueDays,
          overdue_level: getOverdueLevel(overdueDays)
        });
      }
    });

    return overdueMilestones;
  },

  checkForPaymentDelays: async () => {
    return await allAsync(`
      SELECT i.*, m.name as milestone_name, m.due_date as milestone_due_date,
             p.name as project_name, p.client as client_name
      FROM invoices i
      JOIN milestones m ON i.milestone_id = m.id
      JOIN projects p ON m.project_id = p.id
      WHERE i.status = 'issued'
      AND i.id NOT IN (
        SELECT DISTINCT invoice_id FROM payment_assignments
      )
      AND julianday('now') - julianday(i.issued_date) > 30
      ORDER BY i.issued_date ASC
    `);
  },

  getDashboardAlerts: async () => {
    const overdueMilestones = await alertService.checkForOverdueMilestones();
    const paymentDelays = await alertService.checkForPaymentDelays();

    return {
      overdue_milestones: {
        count: overdueMilestones.length,
        items: overdueMilestones,
        by_level: {
          critical: overdueMilestones.filter(m => m.overdue_level === 'critical').length,
          warning: overdueMilestones.filter(m => m.overdue_level === 'warning').length,
          attention: overdueMilestones.filter(m => m.overdue_level === 'attention').length
        }
      },
      payment_delays: {
        count: paymentDelays.length,
        items: paymentDelays
      },
      summary: {
        total_alerts: overdueMilestones.length + paymentDelays.length,
        critical_count: overdueMilestones.filter(m => m.overdue_level === 'critical').length
      }
    };
  },

  getProjectAlerts: async (projectId) => {
    const milestones = await allAsync(`
      SELECT m.*
      FROM milestones m
      WHERE m.project_id = ?
      AND m.status NOT IN ('paid', 'invoiced')
      ORDER BY m.due_date ASC
    `, [projectId]);

    const overdueMilestones = [];
    
    milestones.forEach(milestone => {
      const isOverdue = BUSINESS_RULES.isMilestoneOverdue(milestone.due_date);
      if (isOverdue) {
        const overdueDays = BUSINESS_RULES.getOverdueDays(milestone.due_date);
        overdueMilestones.push({
          ...milestone,
          overdue_days: overdueDays,
          overdue_level: getOverdueLevel(overdueDays)
        });
      }
    });

    return {
      project_id: projectId,
      overdue_milestones: overdueMilestones,
      count: overdueMilestones.length
    };
  }
};

function getOverdueLevel(days) {
  if (days >= 90) return 'critical';
  if (days >= 30) return 'warning';
  return 'attention';
}

module.exports = alertService;
