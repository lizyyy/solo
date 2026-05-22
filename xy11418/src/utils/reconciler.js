const dbHelper = require('./db-helper');
const { v4: uuidv4 } = require('uuid');

const reconcileOrder = async (orderNo) => {
  const order = await dbHelper.get(
    'SELECT * FROM repair_orders WHERE order_no = ?',
    [orderNo]
  );

  if (!order) {
    throw new Error(`报修单 ${orderNo} 不存在`);
  }

  const receipts = await dbHelper.all(
    'SELECT * FROM repair_receipts WHERE order_no = ?',
    [orderNo]
  );

  const materials = await dbHelper.all(
    'SELECT * FROM material_usages WHERE order_no = ?',
    [orderNo]
  );

  const refunds = await dbHelper.all(
    'SELECT * FROM refund_transactions WHERE order_no = ?',
    [orderNo]
  );

  const totalLaborFee = receipts.reduce((sum, r) => sum + (r.labor_fee || 0), 0);
  const totalMaterialFee = materials.reduce((sum, m) => sum + (m.total_price || 0), 0);
  const totalRefund = refunds.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const netAmount = totalLaborFee + totalMaterialFee - totalRefund;

  const issues = [];

  const receiptCount = receipts.length;
  const reworkCount = receipts.filter(r => r.is_rework).length;
  const partReplaceCount = receipts.filter(r => r.is_part_replacement).length;

  if (receiptCount > 1 && reworkCount > 0) {
    issues.push(`存在返修记录，共 ${receiptCount} 张回执，其中 ${reworkCount} 张为返修`);
  }

  if (partReplaceCount > 0 && materials.length === 0) {
    issues.push('标记为换件但无材料领用记录');
  }

  const isConsistent = issues.length === 0;

  const snapshotNo = 'SNAP-' + uuidv4().substr(0, 8).toUpperCase();

  const sql = `
    INSERT INTO reconcile_snapshots
    (snapshot_no, order_no, order_data, receipts_data, materials_data, refunds_data,
     total_labor_fee, total_material_fee, total_refund, net_amount, is_consistent, issues)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await dbHelper.run(sql, [
    snapshotNo,
    orderNo,
    JSON.stringify(order),
    JSON.stringify(receipts),
    JSON.stringify(materials),
    JSON.stringify(refunds),
    totalLaborFee,
    totalMaterialFee,
    totalRefund,
    netAmount,
    isConsistent ? 1 : 0,
    JSON.stringify(issues)
  ]);

  await dbHelper.run(
    `INSERT INTO audit_logs (action, entity_type, entity_id, after_data, operator, remark)
     VALUES ('reconcile', 'order', ?, ?, 'system', '生成对账快照')`,
    [orderNo, JSON.stringify({ snapshotNo, isConsistent, issues })]
  );

  return {
    snapshotNo,
    orderNo,
    totalLaborFee,
    totalMaterialFee,
    totalRefund,
    netAmount,
    isConsistent,
    issues,
    receiptCount,
    reworkCount,
    partReplaceCount,
    materialCount: materials.length,
    refundCount: refunds.length
  };
};

const getOrderChain = async (orderNo) => {
  const order = await dbHelper.get(
    'SELECT * FROM repair_orders WHERE order_no = ?',
    [orderNo]
  );

  if (!order) {
    return null;
  }

  const receipts = await dbHelper.all(
    'SELECT * FROM repair_receipts WHERE order_no = ? ORDER BY complete_time',
    [orderNo]
  );

  const materials = await dbHelper.all(
    'SELECT * FROM material_usages WHERE order_no = ? ORDER BY receive_time',
    [orderNo]
  );

  const refunds = await dbHelper.all(
    'SELECT * FROM refund_transactions WHERE order_no = ? ORDER BY trans_time',
    [orderNo]
  );

  const discrepancies = await dbHelper.all(
    'SELECT * FROM discrepancy_records WHERE order_no = ? ORDER BY created_at',
    [orderNo]
  );

  const snapshots = await dbHelper.all(
    'SELECT * FROM reconcile_snapshots WHERE order_no = ? ORDER BY created_at',
    [orderNo]
  );

  return {
    order,
    receipts,
    materials,
    refunds,
    discrepancies,
    snapshots,
    chain: buildTimeline(order, receipts, materials, refunds, discrepancies, snapshots)
  };
};

const buildTimeline = (order, receipts, materials, refunds, discrepancies, snapshots) => {
  const timeline = [];

  timeline.push({
    type: 'report',
    time: order.report_time,
    title: '住户报修',
    data: order
  });

  receipts.forEach(r => {
    timeline.push({
      type: 'receipt',
      time: r.complete_time || r.arrival_time,
      title: `维修回执${r.is_rework ? '(返修)' : ''}${r.is_part_replacement ? '(换件)' : ''}`,
      data: r
    });
  });

  materials.forEach(m => {
    timeline.push({
      type: 'material',
      time: m.receive_time,
      title: `材料领用: ${m.material_name}`,
      data: m
    });
  });

  refunds.forEach(r => {
    timeline.push({
      type: 'refund',
      time: r.trans_time,
      title: `退款: ${r.refund_amount}元`,
      data: r
    });
  });

  discrepancies.forEach(d => {
    timeline.push({
      type: 'discrepancy',
      time: d.created_at,
      title: `差异记录: ${d.discrepancy_type}`,
      data: d
    });
  });

  snapshots.forEach(s => {
    timeline.push({
      type: 'snapshot',
      time: s.created_at,
      title: `对账快照${s.is_consistent ? '(一致)' : '(有异常)'}`,
      data: s
    });
  });

  return timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
};

const addDiscrepancy = async (orderNo, type, description, reporter) => {
  const discrepancyNo = 'DISP-' + uuidv4().substr(0, 8).toUpperCase();

  const currentSnap = await dbHelper.get(
    'SELECT * FROM reconcile_snapshots WHERE order_no = ? ORDER BY created_at DESC LIMIT 1',
    [orderNo]
  );

  const sql = `
    INSERT INTO discrepancy_records
    (discrepancy_no, order_no, discrepancy_type, description, before_snapshot, reporter, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `;

  await dbHelper.run(sql, [
    discrepancyNo,
    orderNo,
    type,
    description,
    currentSnap ? JSON.stringify(currentSnap) : null,
    reporter
  ]);

  return { discrepancy_no: discrepancyNo, order_no: orderNo, type, description };
};

module.exports = {
  reconcileOrder,
  getOrderChain,
  addDiscrepancy
};
