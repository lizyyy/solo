const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const { getBatchDetail, getStatistics } = require('./batchService');

const exportDir = path.join(__dirname, '..', '..', 'exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

async function exportBatchToCsv(batchNo) {
  const detail = await getBatchDetail(batchNo);
  if (!detail) {
    throw new Error('批次不存在');
  }

  const { batch, records, stats } = detail;
  const filename = `批次_${batchNo}_${Date.now()}.csv`;
  const filePath = path.join(exportDir, filename);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'store_id', title: '门店编号' },
      { id: 'store_name', title: '门店名称' },
      { id: 'region', title: '区域' },
      { id: 'record_date', title: '日期' },
      { id: 'opening_cash', title: '期初现金' },
      { id: 'pos_sales', title: 'POS销售' },
      { id: 'cash_deposit', title: '现金缴存' },
      { id: 'imprest_borrow', title: '备用金借支' },
      { id: 'imprest_return', title: '备用金归还' },
      { id: 'theoretical_cash', title: '理论应有现金' },
      { id: 'closing_cash', title: '期末实存现金' },
      { id: 'cash_short_long', title: '现金长短款' },
      { id: 'is_balanced', title: '是否对账平衡' },
      { id: 'is_holiday', title: '是否节假日' },
      { id: 'holiday_delay_note', title: '节假日延迟入账说明' },
      { id: 'category', title: '数据分类' },
      { id: 'category_reason', title: '分类原因' },
      { id: 'next_action', title: '后续动作' },
      { id: 'processor', title: '最后处理人' },
      { id: 'batch_no', title: '批次号' }
    ]
  });

  const data = records.map(r => ({
    ...r,
    store_name: batch.store_name,
    region: batch.region,
    batch_no: batch.batch_no,
    is_balanced: r.is_balanced ? '是' : '否',
    is_holiday: r.is_holiday ? '是' : '否'
  }));

  await csvWriter.writeRecords(data);
  return {
    filename,
    filePath,
    batch,
    stats,
    recordCount: records.length
  };
}

async function exportStatisticsToCsv(params = {}) {
  const stats = await getStatistics(params);
  const timestamp = Date.now();
  const filename = `统计报表_${timestamp}.csv`;
  const filePath = path.join(exportDir, filename);

  const summaryRows = [
    { type: '汇总统计', item: '总记录数', value: stats.summary.total_records },
    { type: '汇总统计', item: '总批次数', value: stats.summary.total_batches },
    { type: '汇总统计', item: '涉及门店数', value: stats.summary.total_stores },
    { type: '汇总统计', item: 'POS销售总额', value: stats.summary.total_sales?.toFixed(2) },
    { type: '汇总统计', item: '现金缴存总额', value: stats.summary.total_deposit?.toFixed(2) },
    { type: '汇总统计', item: '备用金借支总额', value: stats.summary.total_imprest_borrow?.toFixed(2) },
    { type: '汇总统计', item: '备用金归还总额', value: stats.summary.total_imprest_return?.toFixed(2) },
    { type: '汇总统计', item: '现金长短款合计', value: stats.summary.total_short_long?.toFixed(2) },
    { type: '分类统计', item: '正常记录数', value: stats.summary.normal_count },
    { type: '分类统计', item: '待补充记录数', value: stats.summary.pending_count },
    { type: '分类统计', item: '已拦截记录数', value: stats.summary.blocked_count }
  ];

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'type', title: '统计类型' },
      { id: 'item', title: '项目' },
      { id: 'value', title: '数值' }
    ]
  });

  await csvWriter.writeRecords(summaryRows);
  return {
    filename,
    filePath,
    stats
  };
}

function getExportFilePath(filename) {
  const filePath = path.join(exportDir, filename);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

module.exports = {
  exportBatchToCsv,
  exportStatisticsToCsv,
  getExportFilePath,
  exportDir
};
