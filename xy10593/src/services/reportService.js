const { prepare } = require('../database');
const { getStatusHistory, getManualCorrections } = require('../utils');

const getDashboard = () => {
  const projectCount = prepare('SELECT COUNT(*) as count FROM projects').get([]);
  const propertyCount = prepare('SELECT COUNT(*) as count FROM properties').get([]);
  const channelCount = prepare('SELECT COUNT(*) as count FROM channels').get([]);
  const customerCount = prepare('SELECT COUNT(*) as count FROM customers').get([]);
  
  const propertyStatus = prepare(`
    SELECT status, COUNT(*) as count
    FROM properties
    GROUP BY status
  `).all([]);
  
  const bookingStatus = prepare(`
    SELECT status, COUNT(*) as count
    FROM bookings
    GROUP BY status
  `).all([]);
  
  const depositSummary = prepare(`
    SELECT
      status,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM deposits
    GROUP BY status
  `).all([]);
  
  const commissionSummary = prepare(`
    SELECT
      status,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM commissions
    GROUP BY status
  `).all([]);
  
  return {
    overview: {
      project_count: projectCount?.count || 0,
      property_count: propertyCount?.count || 0,
      channel_count: channelCount?.count || 0,
      customer_count: customerCount?.count || 0
    },
    property_status: propertyStatus,
    booking_status: bookingStatus,
    deposit_summary: depositSummary,
    commission_summary: commissionSummary
  };
};

const getPropertyTimelineReport = (propertyId) => {
  const property = prepare(`
    SELECT p.*, pr.project_name, pr.project_code
    FROM properties p
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ?
  `).get([propertyId]);
  
  if (!property) return null;
  
  const history = prepare(`
    SELECT * FROM status_history
    WHERE entity_type = 'property' AND entity_id = ?
    ORDER BY created_at ASC
  `).all([propertyId]);
  
  const corrections = prepare(`
    SELECT * FROM manual_corrections
    WHERE entity_type = 'property' AND entity_id = ?
    ORDER BY created_at ASC
  `).all([propertyId]);
  
  const booking = property.current_booking_id
    ? prepare(`
        SELECT b.*,
               c.name as customer_name, c.phone as customer_phone,
               ch.channel_name
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN channels ch ON b.channel_id = ch.id
        WHERE b.id = ?
      `).get([property.current_booking_id])
    : null;
  
  const allBookings = prepare(`
    SELECT b.*,
           c.name as customer_name,
           ch.channel_name
    FROM bookings b
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN channels ch ON b.channel_id = ch.id
    WHERE b.property_id = ?
    ORDER BY b.created_at ASC
  `).all([propertyId]);
  
  return {
    property,
    current_booking: booking,
    all_bookings: allBookings,
    status_history: history.map(h => ({
      ...h,
      details: h.details ? JSON.parse(h.details) : null
    })),
    manual_corrections: corrections
  };
};

const getDepositLedgerReport = (bookingId = null) => {
  let sql = `
    SELECT d.*,
           b.booking_code,
           p.property_code, pr.project_name,
           c.name as customer_name
    FROM deposits d
    LEFT JOIN bookings b ON d.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (bookingId) {
    sql += ' AND d.booking_id = ?';
    params.push(bookingId);
  }
  
  sql += ' ORDER BY d.created_at DESC';
  
  const deposits = prepare(sql).all(params);
  
  const summary = {
    total_pending: 0,
    total_paid: 0,
    total_failed: 0,
    total_refunded: 0,
    net_amount: 0,
    count: deposits.length
  };
  
  const depositsWithHistory = deposits.map(d => {
    summary[d.status] = (summary[d.status] || 0) + d.amount;
    if (d.status === 'paid') summary.net_amount += d.amount;
    if (d.status === 'refunded') summary.net_amount -= d.amount;
    summary[`count_${d.status}`] = (summary[`count_${d.status}`] || 0) + 1;
    
    return {
      ...d,
      history: getStatusHistory('deposit', d.id)
    };
  });
  
  return {
    summary,
    deposits: depositsWithHistory
  };
};

const getCustomerChangesReport = (bookingId = null) => {
  let sql = `
    SELECT nca.*,
           oc.name as old_customer_name, oc.phone as old_customer_phone, oc.customer_code as old_customer_code,
           nc.name as new_customer_name, nc.phone as new_customer_phone, nc.customer_code as new_customer_code,
           b.booking_code,
           p.property_code, pr.project_name
    FROM name_change_applications nca
    LEFT JOIN customers oc ON nca.old_customer_id = oc.id
    LEFT JOIN customers nc ON nca.new_customer_id = nc.id
    LEFT JOIN bookings b ON nca.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE 1=1
  `;
  const params = [];
  
  if (bookingId) {
    sql += ' AND nca.booking_id = ?';
    params.push(bookingId);
  }
  
  sql += ' ORDER BY nca.updated_at DESC';
  
  const changes = prepare(sql).all(params);
  
  return {
    count: changes.length,
    changes: changes.map(c => ({
      ...c,
      history: getStatusHistory('name_change', c.id)
    }))
  };
};

const getCommissionReport = (channelId = null, status = null) => {
  let sql = `
    SELECT c.*,
           b.booking_code, b.total_price, b.status as booking_status,
           ch.channel_code, ch.channel_name, ch.commission_rate,
           p.property_code, pr.project_name,
           cu.name as customer_name
    FROM commissions c
    LEFT JOIN bookings b ON c.booking_id = b.id
    LEFT JOIN channels ch ON c.channel_id = ch.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers cu ON b.customer_id = cu.id
    WHERE 1=1
  `;
  const params = [];
  
  if (channelId) {
    sql += ' AND c.channel_id = ?';
    params.push(channelId);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY c.created_at DESC';
  
  const commissions = prepare(sql).all(params);
  
  const summary = {
    total_pending: 0,
    total_approved: 0,
    total_frozen: 0,
    total_settled: 0,
    total_void: 0,
    net_payable: 0,
    count: commissions.length
  };
  
  const commissionsWithHistory = commissions.map(c => {
    if (c.status === 'pending') {
      summary.total_pending += c.amount;
      summary.net_payable += c.amount;
    }
    if (c.status === 'approved') {
      summary.total_approved += c.amount;
      summary.net_payable += c.amount;
    }
    if (c.status === 'frozen') {
      summary.total_frozen += c.amount;
    }
    if (c.status === 'settled') {
      summary.total_settled += c.amount;
    }
    if (c.status === 'void') {
      summary.total_void += c.amount;
    }
    
    return {
      ...c,
      history: getStatusHistory('commission', c.id)
    };
  });
  
  return {
    summary,
    commissions: commissionsWithHistory
  };
};

const getFullReport = () => {
  const dashboard = getDashboard();
  const depositReport = getDepositLedgerReport();
  const customerChanges = getCustomerChangesReport();
  const commissionReport = getCommissionReport();
  
  const recentBookings = prepare(`
    SELECT b.*,
           p.property_code, pr.project_name,
           c.name as customer_name,
           ch.channel_name
    FROM bookings b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN channels ch ON b.channel_id = ch.id
    ORDER BY b.created_at DESC
    LIMIT 20
  `).all([]);
  
  return {
    generated_at: new Date().toISOString(),
    dashboard,
    recent_bookings: recentBookings,
    deposit_ledger: depositReport,
    customer_changes: customerChanges,
    commission_report: commissionReport
  };
};

const exportReport = (format = 'json') => {
  const report = getFullReport();
  
  if (format === 'json') {
    return report;
  }
  
  if (format === 'text') {
    const lines = [];
    lines.push('='.repeat(60));
    lines.push('售楼认购锁房API - 完整业务报告');
    lines.push(`生成时间: ${report.generated_at}`);
    lines.push('='.repeat(60));
    lines.push('');
    
    lines.push('【仪表盘概览】');
    lines.push(`项目数: ${report.dashboard.overview.project_count}`);
    lines.push(`房源数: ${report.dashboard.overview.property_count}`);
    lines.push(`渠道数: ${report.dashboard.overview.channel_count}`);
    lines.push(`客户数: ${report.dashboard.overview.customer_count}`);
    lines.push('');
    
    lines.push('【房源状态】');
    report.dashboard.property_status.forEach(s => {
      lines.push(`  ${s.status}: ${s.count}套`);
    });
    lines.push('');
    
    lines.push('【定金账本汇总】');
    lines.push(`  待支付: ${report.deposit_ledger.summary.total_pending}元 (${report.deposit_ledger.summary.count_pending || 0}笔)`);
    lines.push(`  已到账: ${report.deposit_ledger.summary.total_paid}元 (${report.deposit_ledger.summary.count_paid || 0}笔)`);
    lines.push(`  支付失败: ${report.deposit_ledger.summary.total_failed}元 (${report.deposit_ledger.summary.count_failed || 0}笔)`);
    lines.push(`  已退还: ${report.deposit_ledger.summary.total_refunded}元 (${report.deposit_ledger.summary.count_refunded || 0}笔)`);
    lines.push(`  净收入: ${report.deposit_ledger.summary.net_amount}元`);
    lines.push('');
    
    lines.push('【客户变更记录】');
    lines.push(`  变更次数: ${report.customer_changes.count}`);
    report.customer_changes.changes.forEach(c => {
      lines.push(`  - ${c.application_code}: ${c.old_customer_name} -> ${c.new_customer_name} (${c.booking_code})`);
    });
    lines.push('');
    
    lines.push('【渠道佣金报告】');
    lines.push(`  待审批: ${report.commission_report.summary.total_pending}元`);
    lines.push(`  已审批: ${report.commission_report.summary.total_approved}元`);
    lines.push(`  已冻结: ${report.commission_report.summary.total_frozen}元`);
    lines.push(`  已结算: ${report.commission_report.summary.total_settled}元`);
    lines.push(`  已作废: ${report.commission_report.summary.total_void}元`);
    lines.push(`  应付净额: ${report.commission_report.summary.net_payable}元`);
    lines.push('');
    
    lines.push('='.repeat(60));
    lines.push('报告结束');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
  
  return report;
};

module.exports = {
  getDashboard,
  getPropertyTimelineReport,
  getDepositLedgerReport,
  getCustomerChangesReport,
  getCommissionReport,
  getFullReport,
  exportReport
};
