const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { createObjectCsvWriter } = require('csv-writer');
const config = require('../config');
const { getDb } = require('../db/connection');
const { generateBatchId } = require('./importService');

const REPORT_TYPE_PREFIXES = {
  SETTLEMENT: 'SET',
  MEMBER_BILL: 'MBL',
  DEPOSIT_TRACKING: 'DEP',
  ANOMALY: 'ANA',
  EQUIPMENT_USAGE: 'EQU'
};

const REPORT_TYPES = {
  SETTLEMENT: 'SETTLEMENT',
  MEMBER_BILL: 'MEMBER_BILL',
  DEPOSIT_TRACKING: 'DEPOSIT_TRACKING',
  ANOMALY: 'ANOMALY',
  EQUIPMENT_USAGE: 'EQUIPMENT_USAGE'
};

const ensureReportDir = () => {
  if (!fs.existsSync(config.reports.outputDir)) {
    fs.mkdirSync(config.reports.outputDir, { recursive: true });
  }
};

const generateReportFileName = (reportType, batchId, dateStr) => {
  const typePrefix = REPORT_TYPE_PREFIXES[reportType] || reportType.substring(0, 3).toUpperCase();
  return `${typePrefix}_${batchId}_${dateStr}.csv`;
};

const generateReportHeader = (reportType, orderId, batchId, filters) => {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  return [
    `# 乐队设备租赁结算报告 - ${reportType}`,
    `# 生成时间: ${now}`,
    `# 批次号: ${batchId}`,
    orderId ? `# 租赁单号: ${orderId}` : '',
    filters && filters.start_date ? `# 统计开始: ${filters.start_date}` : '',
    filters && filters.end_date ? `# 统计结束: ${filters.end_date}` : '',
    `# ==== 数据内容 ====`
  ].filter(Boolean).join('\n') + '\n';
};

const generateSettlementReport = async (orderId, batchId) => {
  const db = await getDb();
  ensureReportDir();

  const dateStr = moment().format(config.reports.dateFormat);
  const fileName = generateReportFileName(REPORT_TYPES.SETTLEMENT, batchId, dateStr);
  const filePath = path.join(config.reports.outputDir, fileName);

  const header = generateReportHeader(REPORT_TYPES.SETTLEMENT, orderId, batchId);
  fs.writeFileSync(filePath, header);

  const order = await db.prepare(`
    SELECT ro.*, br.batch_type, br.description as batch_desc
    FROM rental_orders ro
    LEFT JOIN batch_records br ON ro.batch_id = br.batch_id
    WHERE ro.order_id = ?
  `).get(orderId);

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'category', title: '费用类别' },
      { id: 'equipment_name', title: '设备名称' },
      { id: 'member_name', title: '成员姓名' },
      { id: 'member_role', title: '成员角色' },
      { id: 'duration_hours', title: '使用时长(小时)' },
      { id: 'hourly_rate', title: '小时费率' },
      { id: 'allocated_amount', title: '分摊金额' },
      { id: 'allocation_ratio', title: '分摊比例' },
      { id: 'allocation_type', title: '分摊类型' },
      { id: 'order_id', title: '租赁单号' },
      { id: 'batch_id', title: '导入批次' }
    ],
    append: true
  });

  const allocations = await db.prepare(`
    SELECT 
      ea.*,
      e.name as equipment_name,
      e.category as equipment_category,
      m.name as member_name,
      m.role as member_role,
      ur.duration_hours,
      ri.hourly_rate
    FROM expense_allocations ea
    JOIN equipment e ON ea.equipment_id = e.equipment_id
    JOIN members m ON ea.member_id = m.member_id
    LEFT JOIN usage_records ur ON ea.usage_id = ur.usage_id
    LEFT JOIN rental_items ri ON ea.item_id = ri.item_id
    WHERE ea.order_id = ?
    ORDER BY ea.allocation_type, e.name, m.name
  `).all(orderId);

  const records = allocations.map(a => ({
    category: a.allocation_type === 'RENTAL_FEE' ? '租赁费' : '损坏赔偿',
    equipment_name: a.equipment_name,
    member_name: a.member_name,
    member_role: a.member_role || '',
    duration_hours: a.duration_hours || '',
    hourly_rate: a.hourly_rate || '',
    allocated_amount: a.allocated_amount.toFixed(2),
    allocation_ratio: (a.allocation_ratio * 100).toFixed(2) + '%',
    allocation_type: a.allocation_type,
    order_id: orderId,
    batch_id: order.batch_id || ''
  }));

  await csvWriter.writeRecords(records);

  const summaryRows = [
    {},
    { category: '=== 汇总 ===', equipment_name: '', member_name: '', member_role: '', duration_hours: '', hourly_rate: '', allocated_amount: '', allocation_ratio: '', allocation_type: '', order_id: '', batch_id: '' },
    { category: '租赁费合计', equipment_name: '', member_name: '', member_role: '', duration_hours: '', hourly_rate: '', allocated_amount: '', allocation_ratio: '', allocation_type: '', order_id: '', batch_id: '' }
  ];

  const rentalTotal = allocations.filter(a => a.allocation_type === 'RENTAL_FEE').reduce((s, a) => s + a.allocated_amount, 0);
  const damageTotal = allocations.filter(a => a.allocation_type === 'DAMAGE_FEE').reduce((s, a) => s + a.allocated_amount, 0);
  const grandTotal = rentalTotal + damageTotal;

  summaryRows.push(
    { category: '租赁费合计', equipment_name: '', member_name: '', member_role: '', duration_hours: '', hourly_rate: '', allocated_amount: rentalTotal.toFixed(2), allocation_ratio: '', allocation_type: 'RENTAL_FEE', order_id: '', batch_id: '' },
    { category: '损坏赔偿合计', equipment_name: '', member_name: '', member_role: '', duration_hours: '', hourly_rate: '', allocated_amount: damageTotal.toFixed(2), allocation_ratio: '', allocation_type: 'DAMAGE_FEE', order_id: '', batch_id: '' },
    { category: '总计', equipment_name: '', member_name: '', member_role: '', duration_hours: '', hourly_rate: '', allocated_amount: grandTotal.toFixed(2), allocation_ratio: '', allocation_type: 'TOTAL', order_id: '', batch_id: '' }
  );

  const summaryWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'category', title: '费用类别' },
      { id: 'equipment_name', title: '设备名称' },
      { id: 'member_name', title: '成员姓名' },
      { id: 'member_role', title: '成员角色' },
      { id: 'duration_hours', title: '使用时长(小时)' },
      { id: 'hourly_rate', title: '小时费率' },
      { id: 'allocated_amount', title: '分摊金额' },
      { id: 'allocation_ratio', title: '分摊比例' },
      { id: 'allocation_type', title: '分摊类型' },
      { id: 'order_id', title: '租赁单号' },
      { id: 'batch_id', title: '导入批次' }
    ],
    append: true
  });
  await summaryWriter.writeRecords(summaryRows.slice(1));

  return {
    fileName,
    filePath,
    orderId,
    batchId,
    totals: {
      rental_total: rentalTotal,
      damage_total: damageTotal,
      grand_total: grandTotal
    }
  };
};

const generateMemberBillReport = async (memberId, batchId, filters = {}) => {
  const db = await getDb();
  ensureReportDir();

  const dateStr = moment().format(config.reports.dateFormat);
  const fileName = generateReportFileName(REPORT_TYPES.MEMBER_BILL, batchId, dateStr);
  const filePath = path.join(config.reports.outputDir, fileName);

  const header = generateReportHeader(REPORT_TYPES.MEMBER_BILL, memberId, batchId, filters);
  fs.writeFileSync(filePath, header);

  const member = await db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId);
  if (!member) {
    throw new Error(`Member not found: ${memberId}`);
  }

  const conditions = ['ea.member_id = ?'];
  const params = [memberId];

  if (filters.start_date) {
    conditions.push('ro.order_date >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('ro.order_date <= ?');
    params.push(filters.end_date);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'order_date', title: '租赁日期' },
      { id: 'order_id', title: '租赁单号' },
      { id: 'order_status', title: '单据状态' },
      { id: 'equipment_name', title: '设备名称' },
      { id: 'usage_start', title: '使用开始' },
      { id: 'usage_end', title: '使用结束' },
      { id: 'duration_hours', title: '使用时长' },
      { id: 'fee_type', title: '费用类型' },
      { id: 'amount', title: '金额' },
      { id: 'batch_id', title: '导入批次' }
    ],
    append: true
  });

  const allocations = await db.prepare(`
    SELECT 
      ea.*,
      e.name as equipment_name,
      ro.order_id,
      ro.order_date,
      ro.status as order_status,
      ro.batch_id,
      ur.start_time,
      ur.end_time,
      ur.duration_hours
    FROM expense_allocations ea
    JOIN equipment e ON ea.equipment_id = e.equipment_id
    JOIN rental_orders ro ON ea.order_id = ro.order_id
    LEFT JOIN usage_records ur ON ea.usage_id = ur.usage_id
    ${whereClause}
    ORDER BY ro.order_date DESC, ea.created_at DESC
  `).all(...params);

  const records = allocations.map(a => ({
    order_date: a.order_date,
    order_id: a.order_id,
    order_status: a.order_status,
    equipment_name: a.equipment_name,
    usage_start: a.start_time || '',
    usage_end: a.end_time || '',
    duration_hours: a.duration_hours || '',
    fee_type: a.allocation_type === 'RENTAL_FEE' ? '租赁费' : '损坏赔偿',
    amount: a.allocated_amount.toFixed(2),
    batch_id: a.batch_id || ''
  }));

  await csvWriter.writeRecords(records);

  const totalAmount = allocations.reduce((s, a) => s + a.allocated_amount, 0);
  const summaryWriter = createObjectCsvWriter({
    path: filePath,
    header: [{ id: 'member', title: '成员' }, { id: 'total', title: '应付总额' }],
    append: true
  });
  await summaryWriter.writeRecords([
    {},
    { member: `${member.name}(${member.role || '成员'}) 应付总额`, total: `¥${totalAmount.toFixed(2)}` }
  ]);

  return {
    fileName,
    filePath,
    memberId,
    memberName: member.name,
    batchId,
    totalAmount
  };
};

const generateDepositTrackingReport = async (batchId, filters = {}) => {
  const db = await getDb();
  ensureReportDir();

  const dateStr = moment().format(config.reports.dateFormat);
  const fileName = generateReportFileName(REPORT_TYPES.DEPOSIT_TRACKING, batchId, dateStr);
  const filePath = path.join(config.reports.outputDir, fileName);

  const header = generateReportHeader(REPORT_TYPES.DEPOSIT_TRACKING, null, batchId, filters);
  fs.writeFileSync(filePath, header);

  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('d.status = ?');
    params.push(filters.status);
  }
  if (filters.unrefunded_only) {
    conditions.push('(d.collected_amount - d.refunded_amount - d.deducted_amount) > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'deposit_id', title: '押金编号' },
      { id: 'order_id', title: '租赁单号' },
      { id: 'order_date', title: '租赁日期' },
      { id: 'order_status', title: '单据状态' },
      { id: 'equipment_name', title: '设备名称' },
      { id: 'collected_amount', title: '收取金额' },
      { id: 'refunded_amount', title: '已退金额' },
      { id: 'deducted_amount', title: '扣除金额' },
      { id: 'remaining_amount', title: '待退金额' },
      { id: 'deposit_status', title: '押金状态' },
      { id: 'collected_at', title: '收取时间' },
      { id: 'refunded_at', title: '退款时间' },
      { id: 'batch_id', title: '导入批次' }
    ],
    append: true
  });

  const deposits = await db.prepare(`
    SELECT 
      d.*,
      e.name as equipment_name,
      ro.order_date,
      ro.status as order_status,
      ro.batch_id,
      (d.collected_amount - d.refunded_amount - d.deducted_amount) as remaining_amount
    FROM deposits d
    JOIN equipment e ON d.equipment_id = e.equipment_id
    JOIN rental_orders ro ON d.order_id = ro.order_id
    ${whereClause}
    ORDER BY d.created_at DESC
  `).all(...params);

  const records = deposits.map(d => ({
    deposit_id: d.deposit_id,
    order_id: d.order_id,
    order_date: d.order_date,
    order_status: d.order_status,
    equipment_name: d.equipment_name,
    collected_amount: d.collected_amount.toFixed(2),
    refunded_amount: d.refunded_amount.toFixed(2),
    deducted_amount: d.deducted_amount.toFixed(2),
    remaining_amount: d.remaining_amount.toFixed(2),
    deposit_status: d.status,
    collected_at: d.collected_at || '',
    refunded_at: d.refunded_at || '',
    batch_id: d.batch_id || ''
  }));

  await csvWriter.writeRecords(records);

  const totalCollected = deposits.reduce((s, d) => s + d.collected_amount, 0);
  const totalRefunded = deposits.reduce((s, d) => s + d.refunded_amount, 0);
  const totalDeducted = deposits.reduce((s, d) => s + d.deducted_amount, 0);
  const totalRemaining = totalCollected - totalRefunded - totalDeducted;

  const summaryWriter = createObjectCsvWriter({
    path: filePath,
    header: [{ id: 'item', title: '项目' }, { id: 'amount', title: '金额' }],
    append: true
  });
  await summaryWriter.writeRecords([
    {},
    { item: '收取总额', amount: `¥${totalCollected.toFixed(2)}` },
    { item: '已退总额', amount: `¥${totalRefunded.toFixed(2)}` },
    { item: '扣除总额', amount: `¥${totalDeducted.toFixed(2)}` },
    { item: '待退总额', amount: `¥${totalRemaining.toFixed(2)}` }
  ]);

  return {
    fileName,
    filePath,
    batchId,
    totalRecords: deposits.length,
    totals: {
      total_collected: totalCollected,
      total_refunded: totalRefunded,
      total_deducted: totalDeducted,
      total_remaining: totalRemaining
    }
  };
};

const generateAnomalyReport = async (batchId, filters = {}) => {
  const db = await getDb();
  ensureReportDir();

  const dateStr = moment().format(config.reports.dateFormat);
  const fileName = generateReportFileName(REPORT_TYPES.ANOMALY, batchId, dateStr);
  const filePath = path.join(config.reports.outputDir, fileName);

  const header = generateReportHeader(REPORT_TYPES.ANOMALY, null, batchId, filters);
  fs.writeFileSync(filePath, header);

  const conditions = [];
  const params = [];

  if (filters.anomaly_type) {
    conditions.push('anomaly_type = ?');
    params.push(filters.anomaly_type);
  }
  if (filters.is_resolved !== undefined) {
    conditions.push('is_resolved = ?');
    params.push(filters.is_resolved ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'anomaly_id', title: '异常编号' },
      { id: 'anomaly_type', title: '异常类型' },
      { id: 'severity', title: '严重程度' },
      { id: 'entity_type', title: '关联实体' },
      { id: 'entity_id', title: '实体编号' },
      { id: 'description', title: '异常描述' },
      { id: 'is_resolved', title: '是否已解决' },
      { id: 'detected_at', title: '检测时间' },
      { id: 'resolved_at', title: '解决时间' },
      { id: 'resolution_notes', title: '解决说明' }
    ],
    append: true
  });

  const anomalies = await db.prepare(`
    SELECT * FROM anomalies ${whereClause}
    ORDER BY detected_at DESC
  `).all(...params);

  const records = anomalies.map(a => ({
    anomaly_id: a.anomaly_id,
    anomaly_type: a.anomaly_type,
    severity: a.severity,
    entity_type: a.entity_type || '',
    entity_id: a.entity_id || '',
    description: a.description,
    is_resolved: a.is_resolved ? '是' : '否',
    detected_at: a.detected_at,
    resolved_at: a.resolved_at || '',
    resolution_notes: a.resolution_notes || ''
  }));

  await csvWriter.writeRecords(records);

  const unresolvedCount = anomalies.filter(a => !a.is_resolved).length;
  const summaryWriter = createObjectCsvWriter({
    path: filePath,
    header: [{ id: 'item', title: '项目' }, { id: 'count', title: '数量' }],
    append: true
  });
  await summaryWriter.writeRecords([
    {},
    { item: '异常总数', count: anomalies.length },
    { item: '待解决', count: unresolvedCount },
    { item: '已解决', count: anomalies.length - unresolvedCount }
  ]);

  return {
    fileName,
    filePath,
    batchId,
    totalAnomalies: anomalies.length,
    unresolvedCount
  };
};

const listReports = () => {
  ensureReportDir();
  const files = fs.readdirSync(config.reports.outputDir);
  
  return files
    .filter(f => f.endsWith('.csv'))
    .map(f => {
      const stats = fs.statSync(path.join(config.reports.outputDir, f));
      return {
        fileName: f,
        filePath: path.join(config.reports.outputDir, f),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
};

const getReportFilePath = (fileName) => {
  const filePath = path.join(config.reports.outputDir, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return filePath;
};

module.exports = {
  REPORT_TYPES,
  generateSettlementReport,
  generateMemberBillReport,
  generateDepositTrackingReport,
  generateAnomalyReport,
  listReports,
  getReportFilePath,
  generateBatchId
};
