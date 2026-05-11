const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { formatCurrency, formatDate, ensureDirectory } = require('./utils');

async function exportToCsv(settlementId, outputPath) {
  const { getSettlementById } = require('./settlement');
  const data = await getSettlementById(settlementId);
  if (!data) {
    throw new Error(`结算记录不存在: ${settlementId}`);
  }
  
  const { settlement, items, summary } = data;
  
  const headers = [
    '摊主名称',
    '摊位',
    '总销售额',
    '退款金额',
    '净销售额',
    '抽成金额',
    '押金',
    '电费',
    '已付款',
    '应付金额',
    '调整说明'
  ];
  
  const rows = items.map(item => [
    item.vendor_name,
    item.booth_number || '-',
    item.total_sales,
    item.total_refunds,
    item.net_sales,
    item.commission_amount,
    item.deposit_amount,
    item.electricity_fee,
    item.previous_payments,
    item.amount_due,
    (item.adjustment_note || '').replace(/\n/g, '; ')
  ]);
  
  let csvContent = '\ufeff';
  csvContent += headers.join(',') + '\n';
  csvContent += rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  csvContent += '\n\n';
  csvContent += `结算周期,${settlement.period_start} 至 ${settlement.period_end}\n`;
  csvContent += `结算日期,${settlement.settlement_date}\n`;
  csvContent += `摊主数量,${summary.total_vendors}\n`;
  csvContent += `总销售额,${summary.total_sales}\n`;
  csvContent += `总退款,${summary.total_refunds}\n`;
  csvContent += `总抽成,${summary.total_commission}\n`;
  csvContent += `总应付,${summary.total_due}\n`;
  
  ensureDirectory(path.dirname(outputPath));
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  
  return {
    success: true,
    filePath: outputPath,
    itemCount: items.length
  };
}

async function exportToJson(settlementId, outputPath) {
  const { getSettlementById } = require('./settlement');
  const data = await getSettlementById(settlementId);
  if (!data) {
    throw new Error(`结算记录不存在: ${settlementId}`);
  }
  
  const jsonContent = JSON.stringify(data, null, 2);
  
  ensureDirectory(path.dirname(outputPath));
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
  
  return {
    success: true,
    filePath: outputPath
  };
}

async function exportVendorStatement(settlementId, vendorId, outputPath) {
  const { getSettlementById } = require('./settlement');
  const data = await getSettlementById(settlementId);
  if (!data) {
    throw new Error(`结算记录不存在: ${settlementId}`);
  }
  
  const vendorItem = data.items.find(i => i.vendor_id === vendorId);
  if (!vendorItem) {
    throw new Error(`摊主不在此结算中: ${vendorId}`);
  }
  
  const statement = generateVendorStatement(vendorItem, data.settlement);
  
  ensureDirectory(path.dirname(outputPath));
  fs.writeFileSync(outputPath, statement, 'utf-8');
  
  return {
    success: true,
    filePath: outputPath
  };
}

function generateVendorStatement(item, settlement) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push('                摊主结算单');
  lines.push('='.repeat(60));
  lines.push('');
  
  lines.push(`摊主: ${item.vendor_name}`);
  lines.push(`摊位: ${item.booth_number || '-'}`);
  lines.push(`结算周期: ${settlement.period_start} 至 ${settlement.period_end}`);
  lines.push(`结算日期: ${settlement.settlement_date}`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('一、销售明细');
  lines.push('-'.repeat(60));
  lines.push(`  总销售额: ${formatCurrency(item.total_sales)}`);
  lines.push(`  退款金额: ${formatCurrency(item.total_refunds)}`);
  lines.push(`  净销售额: ${formatCurrency(item.net_sales)}`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('二、抽成计算');
  lines.push('-'.repeat(60));
  
  if (item.booths && item.booths.length > 0) {
    for (const booth of item.booths) {
      let rateStr = '';
      if (booth.commission_rate) {
        if (booth.commission_rate.rate_type === 'flat') {
          rateStr = `固定 ${(booth.commission_rate.flat_rate * 100).toFixed(1)}%`;
        } else {
          rateStr = '阶梯抽成';
        }
      }
      lines.push(`  摊位 ${booth.booth_id}:`);
      lines.push(`    抽成比例: ${rateStr}`);
      lines.push(`    销售额: ${formatCurrency(booth.total_sales)}`);
      lines.push(`    退款: ${formatCurrency(booth.total_refunds)}`);
      lines.push(`    抽成金额: ${formatCurrency(booth.commission_amount || 0)}`);
    }
  }
  
  lines.push(`  抽成合计: ${formatCurrency(item.commission_amount)}`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('三、其他扣款');
  lines.push('-'.repeat(60));
  lines.push(`  押金: ${formatCurrency(item.deposit_amount)}`);
  lines.push(`  电费: ${formatCurrency(item.electricity_fee)}`);
  lines.push(`  已付款: ${formatCurrency(item.previous_payments)}`);
  lines.push('');
  
  if (item.adjustments && item.adjustments.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('四、调整记录');
    lines.push('-'.repeat(60));
    for (const adj of item.adjustments) {
      lines.push(`  [${formatDate(adj.created_at)}] ${adj.adjustment_type}: ${adj.amount > 0 ? '+' : ''}${formatCurrency(adj.amount)}`);
      if (adj.reason) lines.push(`    原因: ${adj.reason}`);
      if (adj.note) lines.push(`    说明: ${adj.note}`);
    }
    lines.push('');
  }
  
  lines.push('='.repeat(60));
  lines.push(`应付金额: ${formatCurrency(item.amount_due)}`);
  lines.push('='.repeat(60));
  
  if (item.adjustment_note) {
    lines.push('');
    lines.push('调整说明:');
    lines.push(item.adjustment_note);
  }
  
  return lines.join('\n');
}

async function exportImportHistory(exportPath) {
  const { getDb } = require('./db');
  const db = await getDb();
  
  const imports = db.prepare(`
    SELECT * FROM import_logs 
    ORDER BY created_at DESC
  `).all();
  
  const headers = [
    'ID',
    '数据类型',
    '文件路径',
    '导入时间',
    '总记录数',
    '处理数',
    '跳过数'
  ];
  
  const rows = imports.map(i => [
    i.id,
    i.data_type,
    i.file_path,
    i.created_at,
    i.records_count,
    i.processed_count,
    i.skipped_count
  ]);
  
  let csvContent = '\ufeff';
  csvContent += headers.join(',') + '\n';
  csvContent += rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  ensureDirectory(path.dirname(exportPath));
  fs.writeFileSync(exportPath, csvContent, 'utf-8');
  
  return {
    success: true,
    filePath: exportPath,
    recordCount: imports.length
  };
}

module.exports = {
  exportToCsv,
  exportToJson,
  exportVendorStatement,
  generateVendorStatement,
  exportImportHistory
};
