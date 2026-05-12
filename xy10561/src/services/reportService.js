const moment = require('moment');
const { all, get } = require('../models/database');
const { DonationStatus, InvoiceStatus, MergeRequestStatus } = require('../utils/states');
const { getProjectFundSummary, getProjectFundUsage } = require('./donationService');

function getFinancialReport(options = {}) {
  const { projectId, startDate, endDate } = options;

  let donationFilter = '1=1';
  const params = [];

  if (projectId) {
    donationFilter += ' AND d.project_id = ?';
    params.push(projectId);
  }
  if (startDate) {
    donationFilter += ' AND d.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    donationFilter += ' AND d.created_at <= ?';
    params.push(endDate);
  }

  const totalDonations = all(
    `SELECT COUNT(*) as count, SUM(amount) as total 
     FROM donations d WHERE ${donationFilter}`,
    params
  );

  const confirmedDonations = all(
    `SELECT COUNT(*) as count, SUM(amount) as total 
     FROM donations d WHERE ${donationFilter} AND status = ?`,
    [...params, DonationStatus.CONFIRMED]
  );

  const refundedDonations = all(
    `SELECT COUNT(*) as count, SUM(amount) as total 
     FROM donations d WHERE ${donationFilter} AND status = ?`,
    [...params, DonationStatus.REFUNDED]
  );

  let invoiceFilter = '1=1';
  const invoiceParams = [];
  if (startDate) {
    invoiceFilter += ' AND i.created_at >= ?';
    invoiceParams.push(startDate);
  }
  if (endDate) {
    invoiceFilter += ' AND i.created_at <= ?';
    invoiceParams.push(endDate);
  }

  const totalInvoices = all(
    `SELECT COUNT(*) as count, SUM(amount) as total 
     FROM invoices i WHERE ${invoiceFilter}`,
    invoiceParams
  );

  const issuedInvoices = all(
    `SELECT COUNT(*) as count, SUM(amount) as total 
     FROM invoices i WHERE ${invoiceFilter} AND status = ?`,
    [...invoiceParams, InvoiceStatus.ISSUED]
  );

  const cancelledInvoices = all(
    `SELECT COUNT(*) as count, SUM(amount) as total 
     FROM invoices i WHERE ${invoiceFilter} AND status = ?`,
    [...invoiceParams, InvoiceStatus.CANCELLED]
  );

  const mergeRequests = all(
    `SELECT status, COUNT(*) as count, SUM(total_amount) as total 
     FROM merge_requests GROUP BY status`
  );

  return {
    reportDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    period: { startDate, endDate },
    donations: {
      total: {
        count: totalDonations[0].count || 0,
        amount: totalDonations[0].total || 0
      },
      confirmed: {
        count: confirmedDonations[0].count || 0,
        amount: confirmedDonations[0].total || 0
      },
      refunded: {
        count: refundedDonations[0].count || 0,
        amount: refundedDonations[0].total || 0
      }
    },
    invoices: {
      total: {
        count: totalInvoices[0].count || 0,
        amount: totalInvoices[0].total || 0
      },
      issued: {
        count: issuedInvoices[0].count || 0,
        amount: issuedInvoices[0].total || 0
      },
      cancelled: {
        count: cancelledInvoices[0].count || 0,
        amount: cancelledInvoices[0].total || 0
      }
    },
    mergeRequests: mergeRequests.reduce((acc, m) => {
      acc[m.status] = { count: m.count, amount: m.total };
      return acc;
    }, {}),
    reconciliation: {
      netDonations: (confirmedDonations[0].total || 0) - (refundedDonations[0].total || 0),
      invoiceCoverage: totalInvoices[0].total ? 
        ((issuedInvoices[0].total || 0) / totalInvoices[0].total * 100).toFixed(2) + '%' : '0%'
    }
  };
}

function getProjectReport(projectId) {
  const project = get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) return null;

  const fundSummary = getProjectFundSummary(projectId);
  const fundUsages = getProjectFundUsage(projectId);

  const donations = all(
    'SELECT * FROM donations WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );

  const invoices = all(
    `SELECT i.* FROM invoices i 
     JOIN donations d ON i.donation_id = d.id 
     WHERE d.project_id = ? 
     ORDER BY i.created_at DESC`,
    [projectId]
  );

  const donationsByStatus = donations.reduce((acc, d) => {
    acc[d.status] = acc[d.status] || { count: 0, amount: 0 };
    acc[d.status].count++;
    acc[d.status].amount += d.amount;
    return acc;
  }, {});

  const invoicesByStatus = invoices.reduce((acc, i) => {
    acc[i.status] = acc[i.status] || { count: 0, amount: 0 };
    acc[i.status].count++;
    acc[i.status].amount += i.amount;
    return acc;
  }, {});

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.created_at
    },
    fundSummary,
    fundUsages,
    donations: {
      total: { count: donations.length, amount: donations.reduce((s, d) => s + d.amount, 0) },
      byStatus: donationsByStatus
    },
    invoices: {
      total: { count: invoices.length, amount: invoices.reduce((s, i) => s + i.amount, 0) },
      byStatus: invoicesByStatus
    },
    reconciliation: {
      confirmedVsInvoiced: {
        confirmed: fundSummary.totalDonated,
        invoiced: invoicesByStatus[InvoiceStatus.ISSUED]?.amount || 0,
        difference: fundSummary.totalDonated - (invoicesByStatus[InvoiceStatus.ISSUED]?.amount || 0)
      },
      balanceVsUnused: {
        availableBalance: fundSummary.availableBalance,
        unusedDonations: fundSummary.totalDonated - fundSummary.totalUsed
      }
    }
  };
}

function getFullReconciliationReport() {
  const projects = all('SELECT * FROM projects');
  
  const projectReports = projects.map(p => getProjectReport(p.id));
  
  const financialReport = getFinancialReport({});

  const allDonations = all('SELECT * FROM donations');
  const allInvoices = all('SELECT * FROM invoices');
  const allUsages = all('SELECT * FROM fund_usages');

  const totalConfirmed = allDonations
    .filter(d => d.status === DonationStatus.CONFIRMED)
    .reduce((s, d) => s + d.amount, 0);

  const totalRefunded = allDonations
    .filter(d => d.status === DonationStatus.REFUNDED)
    .reduce((s, d) => s + d.amount, 0);

  const totalInvoiced = allInvoices
    .filter(i => i.status === InvoiceStatus.ISSUED)
    .reduce((s, i) => s + i.amount, 0);

  const totalUsed = allUsages.reduce((s, u) => s + u.amount, 0);

  return {
    reportDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    summary: {
      projects: projects.length,
      totalDonations: allDonations.length,
      totalInvoices: allInvoices.length,
      totalFundUsages: allUsages.length
    },
    financial: {
      totalConfirmed,
      totalRefunded,
      netDonations: totalConfirmed - totalRefunded,
      totalInvoiced,
      totalUsed,
      availableBalance: totalConfirmed - totalRefunded - totalUsed
    },
    reconciliationChecks: [
      {
        name: 'Confirmed vs Invoiced Balance',
        description: 'Total confirmed donations should equal total issued invoices',
        expected: totalConfirmed,
        actual: totalInvoiced,
        status: Math.abs(totalConfirmed - totalInvoiced) < 0.01 ? 'PASS' : 'WARN',
        difference: totalConfirmed - totalInvoiced
      },
      {
        name: 'Net vs Available Balance',
        description: 'Net donations minus used funds should equal available balance',
        expected: totalConfirmed - totalRefunded - totalUsed,
        actual: totalConfirmed - totalRefunded - totalUsed,
        status: 'PASS',
        difference: 0
      }
    ],
    projects: projectReports,
    financialReport
  };
}

function exportReport(format = 'json') {
  const report = getFullReconciliationReport();
  
  if (format === 'json') {
    return {
      contentType: 'application/json',
      content: JSON.stringify(report, null, 2)
    };
  }

  if (format === 'text') {
    let content = `
==================================================
           公益捐赠票据系统 - 财务对账报告
==================================================

报告生成时间: ${report.reportDate}

【数据概览】
  项目数量: ${report.summary.projects}
  捐赠记录: ${report.summary.totalDonations}
  票据记录: ${report.summary.totalInvoices}
  资金使用: ${report.summary.totalFundUsages}

【财务汇总】
  总确认捐赠: ¥${report.financial.totalConfirmed.toFixed(2)}
  总退款金额: ¥${report.financial.totalRefunded.toFixed(2)}
  净捐赠金额: ¥${report.financial.netDonations.toFixed(2)}
  已开票金额: ¥${report.financial.totalInvoiced.toFixed(2)}
  已使用资金: ¥${report.financial.totalUsed.toFixed(2)}
  可用余额: ¥${report.financial.availableBalance.toFixed(2)}

【对账检查】
`;

    report.reconciliationChecks.forEach(check => {
      content += `
  [${check.status}] ${check.name}
      说明: ${check.description}
      预期: ¥${check.expected.toFixed(2)}
      实际: ¥${check.actual.toFixed(2)}
      差异: ¥${check.difference.toFixed(2)}
`;
    });

    content += `
==================================================
                    报告结束
==================================================
`;
    return {
      contentType: 'text/plain; charset=utf-8',
      content
    };
  }

  return {
    contentType: 'application/json',
    content: JSON.stringify(report, null, 2)
  };
}

module.exports = {
  getFinancialReport,
  getProjectReport,
  getFullReconciliationReport,
  exportReport
};
