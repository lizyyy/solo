const { Parser } = require('json2csv');
const dbHelper = require('./db-helper');
const reconciler = require('./reconciler');
const fs = require('fs');
const path = require('path');

const exportOrderToCSV = async (orderNo) => {
  const chain = await reconciler.getOrderChain(orderNo);
  if (!chain) {
    throw new Error(`报修单 ${orderNo} 不存在`);
  }

  const orderFields = ['order_no', 'resident_id', 'resident_name', 'room_no', 'repair_type', 'description', 'report_time', 'status'];
  const receiptFields = ['receipt_no', 'repairman_name', 'arrival_time', 'complete_time', 'repair_content', 'is_rework', 'is_part_replacement', 'labor_fee'];
  const materialFields = ['usage_no', 'material_code', 'material_name', 'quantity', 'unit_price', 'total_price', 'receiver', 'receive_time'];
  const refundFields = ['trans_no', 'refund_amount', 'refund_reason', 'trans_time', 'operator'];

  const orderParser = new Parser({ fields: orderFields });
  const receiptParser = new Parser({ fields: receiptFields });
  const materialParser = new Parser({ fields: materialFields });
  const refundParser = new Parser({ fields: refundFields });

  let csvContent = '\n=== 报修单信息 ===\n';
  csvContent += orderParser.parse([chain.order]);

  csvContent += '\n\n=== 维修回执 ===\n';
  csvContent += receiptParser.parse(chain.receipts);

  csvContent += '\n\n=== 材料领用 ===\n';
  csvContent += materialParser.parse(chain.materials);

  csvContent += '\n\n=== 退款流水 ===\n';
  csvContent += refundParser.parse(chain.refunds);

  csvContent += '\n\n=== 对账汇总 ===\n';
  const summary = {
    总工费: chain.snapshots.length > 0 ? chain.snapshots[chain.snapshots.length - 1].total_labor_fee : 0,
    总材料费: chain.snapshots.length > 0 ? chain.snapshots[chain.snapshots.length - 1].total_material_fee : 0,
    总退款: chain.snapshots.length > 0 ? chain.snapshots[chain.snapshots.length - 1].total_refund : 0,
    净额: chain.snapshots.length > 0 ? chain.snapshots[chain.snapshots.length - 1].net_amount : 0,
    回执数量: chain.receipts.length,
    返修次数: chain.receipts.filter(r => r.is_rework).length,
    换件次数: chain.receipts.filter(r => r.is_part_replacement).length,
    对账状态: chain.snapshots.length > 0 && chain.snapshots[chain.snapshots.length - 1].is_consistent ? '一致' : '有异常'
  };
  const summaryParser = new Parser({ fields: Object.keys(summary) });
  csvContent += summaryParser.parse([summary]);

  const exportDir = path.join(__dirname, '../../data/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `${orderNo}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, csvContent, 'utf-8');

  return { filepath, filename, content: csvContent };
};

const exportAllOrdersSummary = async () => {
  const orders = await dbHelper.all('SELECT * FROM repair_orders ORDER BY report_time DESC');

  const summaryData = [];
  for (const order of orders) {
    const result = await reconciler.reconcileOrder(order.order_no);
    summaryData.push({
      报修单号: order.order_no,
      住户: order.resident_name,
      房间: order.room_no,
      报修类型: order.repair_type,
      报修时间: order.report_time,
      工费合计: result.totalLaborFee,
      材料费合计: result.totalMaterialFee,
      退款合计: result.totalRefund,
      净额: result.netAmount,
      回执数量: result.receiptCount,
      返修次数: result.reworkCount,
      换件次数: result.partReplaceCount,
      对账状态: result.isConsistent ? '一致' : '异常',
      问题数量: result.issues.length
    });
  }

  const parser = new Parser({ fields: Object.keys(summaryData[0] || {}) });
  const csvContent = parser.parse(summaryData);

  const exportDir = path.join(__dirname, '../../data/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `all_orders_summary_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, csvContent, 'utf-8');

  return { filepath, filename, content: csvContent, data: summaryData };
};

const exportDirtyRecords = async (resolved = null) => {
  let sql = 'SELECT * FROM dirty_records ORDER BY created_at DESC';
  let params = [];
  
  if (resolved !== null) {
    sql += ' WHERE is_resolved = ?';
    params = [resolved ? 1 : 0];
  }

  const records = await dbHelper.all(sql, params);

  const fields = ['id', 'source_type', 'source_id', 'dirty_type', 'field_name', 'error_message', 'suggestion', 'is_resolved', 'resolved_by', 'resolved_note', 'created_at'];
  const parser = new Parser({ fields });
  const csvContent = parser.parse(records);

  const exportDir = path.join(__dirname, '../../data/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `dirty_records_${resolved === null ? 'all' : (resolved ? 'resolved' : 'unresolved')}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, csvContent, 'utf-8');

  return { filepath, filename, content: csvContent, data: records };
};

module.exports = {
  exportOrderToCSV,
  exportAllOrdersSummary,
  exportDirtyRecords
};
