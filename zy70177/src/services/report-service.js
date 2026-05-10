const { getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');
const fs = require('fs');
const path = require('path');

const reportService = {
  getProjectProgressReport: async (projectId) => {
    const project = await getAsync('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      throw new Error('项目不存在');
    }

    const milestones = await allAsync(
      `SELECT * FROM milestones WHERE project_id = ? ORDER BY due_date ASC`,
      [projectId]
    );

    const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
    const totalCollected = milestones.reduce((sum, m) => sum + (m.collected_amount || 0), 0);
    
    const statusBreakdown = {
      pending: milestones.filter(m => m.status === 'pending').length,
      accepted: milestones.filter(m => m.status === 'accepted').length,
      invoiced: milestones.filter(m => m.status === 'invoiced').length,
      paid: milestones.filter(m => m.status === 'paid').length
    };

    return {
      project,
      summary: {
        total_milestones: milestones.length,
        total_amount: totalAmount,
        total_collected: totalCollected,
        collection_progress: totalAmount > 0 ? (totalCollected / totalAmount * 100).toFixed(2) : 0,
        status_breakdown: statusBreakdown
      },
      milestones: milestones.map(m => ({
        ...m,
        progress: BUSINESS_RULES.calculatePaymentProgress(m.amount, m.collected_amount || 0)
      }))
    };
  },

  getCollectionStatusReport: async () => {
    const projects = await allAsync('SELECT * FROM projects');
    
    const projectSummaries = [];
    
    for (const project of projects) {
      const milestones = await allAsync(
        `SELECT * FROM milestones WHERE project_id = ?`,
        [project.id]
      );
      
      const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
      const totalCollected = milestones.reduce((sum, m) => sum + (m.collected_amount || 0), 0);
      
      const overdueMilestones = milestones.filter(m => 
        m.status !== 'paid' && BUSINESS_RULES.isMilestoneOverdue(m.due_date)
      );

      projectSummaries.push({
        project_id: project.id,
        project_name: project.name,
        project_code: project.code,
        client: project.client,
        total_amount: totalAmount,
        total_collected: totalCollected,
        collection_progress: totalAmount > 0 ? (totalCollected / totalAmount * 100).toFixed(2) : 0,
        milestone_count: milestones.length,
        overdue_count: overdueMilestones.length
      });
    }

    const overallTotal = projectSummaries.reduce((sum, p) => sum + p.total_amount, 0);
    const overallCollected = projectSummaries.reduce((sum, p) => sum + p.total_collected, 0);

    return {
      summary: {
        total_projects: projects.length,
        total_amount: overallTotal,
        total_collected: overallCollected,
        collection_progress: overallTotal > 0 ? (overallCollected / overallTotal * 100).toFixed(2) : 0
      },
      projects: projectSummaries
    };
  },

  getMilestoneCollectionReport: async (projectId = null) => {
    const whereClause = projectId ? 'WHERE m.project_id = ?' : '';
    const params = projectId ? [projectId] : [];

    const milestones = await allAsync(`
      SELECT m.*, p.name as project_name, p.client as client_name,
             (SELECT COUNT(*) FROM acceptances a WHERE a.milestone_id = m.id AND a.status = 'confirmed') as acceptance_count,
             (SELECT COUNT(*) FROM invoices i WHERE i.milestone_id = m.id AND i.status = 'issued') as invoice_count
      FROM milestones m
      JOIN projects p ON m.project_id = p.id
      ${whereClause}
      ORDER BY p.name, m.due_date
    `, ...params);

    return milestones.map(m => ({
      ...m,
      is_overdue: BUSINESS_RULES.isMilestoneOverdue(m.due_date),
      overdue_days: BUSINESS_RULES.getOverdueDays(m.due_date),
      progress: BUSINESS_RULES.calculatePaymentProgress(m.amount, m.collected_amount || 0),
      remaining: m.amount - (m.collected_amount || 0)
    }));
  },

  generateCollectionStatusCSV: async (projectId = null) => {
    const report = await reportService.getMilestoneCollectionReport(projectId);
    
    const headers = [
      '项目名称', '客户', '里程碑', '计划日期', '金额', '已收款', '进度%',
      '验收状态', '开票状态', '里程碑状态', '是否逾期', '逾期天数'
    ];

    const rows = report.map(m => [
      m.project_name,
      m.client_name,
      m.name,
      m.due_date,
      m.amount.toFixed(2),
      (m.collected_amount || 0).toFixed(2),
      m.progress.toFixed(2),
      m.acceptance_status,
      m.invoice_status,
      m.status,
      m.is_overdue ? '是' : '否',
      m.overdue_days
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    return csv;
  },

  generateInvoicePaymentReport: async () => {
    const invoices = await allAsync(`
      SELECT i.*, m.name as milestone_name, p.name as project_name, p.client as client_name,
             (SELECT SUM(amount) FROM payment_assignments pa WHERE pa.invoice_id = i.id) as assigned_amount
      FROM invoices i
      JOIN milestones m ON i.milestone_id = m.id
      JOIN projects p ON m.project_id = p.id
      ORDER BY i.created_at DESC
    `);

    return invoices.map(invoice => {
      const assigned = invoice.assigned_amount || 0;
      const remaining = invoice.amount - assigned;
      
      return {
        ...invoice,
        assigned_amount: assigned,
        remaining: remaining,
        progress: BUSINESS_RULES.calculatePaymentProgress(invoice.amount, assigned)
      };
    });
  },

  generateInvoicePaymentCSV: async () => {
    const report = await reportService.generateInvoicePaymentReport();
    
    const headers = [
      '项目名称', '客户', '里程碑', '发票号', '开票金额', '已认领',
      '剩余金额', '进度%', '发票状态', '开票日期'
    ];

    const rows = report.map(i => [
      i.project_name,
      i.client_name,
      i.milestone_name,
      i.invoice_no,
      i.amount.toFixed(2),
      i.assigned_amount.toFixed(2),
      i.remaining.toFixed(2),
      i.progress.toFixed(2),
      i.status,
      i.issued_date || '-'
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    return csv;
  },

  exportReportToFile: async (reportType, projectId = null) => {
    const exportsDir = path.join(__dirname, '../../data/exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    let csv = '';
    let filename = '';
    const timestamp = new Date().toISOString().split('T')[0];

    switch (reportType) {
      case 'collection':
        csv = await reportService.generateCollectionStatusCSV(projectId);
        filename = `收款状态报表_${timestamp}.csv`;
        break;
      case 'invoice_payment':
        csv = await reportService.generateInvoicePaymentCSV();
        filename = `发票回款报表_${timestamp}.csv`;
        break;
      default:
        throw new Error('不支持的报表类型');
    }

    const filepath = path.join(exportsDir, filename);
    fs.writeFileSync(filepath, csv, 'utf-8');

    return {
      filepath,
      filename,
      generated_at: new Date().toISOString()
    };
  }
};

module.exports = reportService;
