const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { initializeDatabase } = require('../models/database');
const { getArrivalOrders, getArrivalOrderById } = require('../services/arrivalService');
const { getTemperatureRecordsByOrderId } = require('../services/temperatureService');
const { getPhotosByOrderId } = require('../services/photoService');
const { getAuditLogs } = require('../services/auditService');
const { getImportErrors } = require('../services/errorService');

function exportOrders(options = {}) {
  initializeDatabase();
  
  const orders = getArrivalOrders(options);
  
  const result = orders.map(order => {
    const temperatures = getTemperatureRecordsByOrderId(order.id);
    const photos = getPhotosByOrderId(order.id);
    
    return {
      ...order,
      temperature_records: temperatures,
      photos: photos
    };
  });
  
  return result;
}

function exportToJson(data, outputPath) {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
  const dir = path.dirname(absolutePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
  return absolutePath;
}

function exportToCsv(orders, outputPath) {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
  const dir = path.dirname(absolutePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const headers = ['id', 'batch_number', 'product_type', 'product_name', 'quantity', 
                   'arrival_date', 'receiver', 'signature', 'damage_status', 
                   'damage_description', 'status', 'created_at', 'operator', 'role'];
  
  const lines = [headers.join(',')];
  
  orders.forEach(order => {
    const line = headers.map(h => {
      const value = order[h] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
    lines.push(line);
  });
  
  fs.writeFileSync(absolutePath, lines.join('\n'), 'utf8');
  return absolutePath;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const format = args[0] || 'json';
  const outputDir = args[1] || 'data/exports';
  const status = args[2];
  
  initializeDatabase();
  
  const timestamp = dayjs().format('YYYYMMDD_HHmmss');
  const options = {};
  if (status) {
    options.status = status;
  }
  
  const orders = exportOrders(options);
  
  if (format === 'json') {
    const outputPath = path.join(outputDir, `arrival_orders_${timestamp}.json`);
    exportToJson(orders, outputPath);
    console.log(`导出成功: ${outputPath}`);
    console.log(`共导出 ${orders.length} 条记录`);
  } else if (format === 'csv') {
    const outputPath = path.join(outputDir, `arrival_orders_${timestamp}.csv`);
    exportToCsv(orders, outputPath);
    console.log(`导出成功: ${outputPath}`);
    console.log(`共导出 ${orders.length} 条记录`);
  } else if (format === 'audit') {
    const logs = getAuditLogs();
    const outputPath = path.join(outputDir, `audit_logs_${timestamp}.json`);
    exportToJson(logs, outputPath);
    console.log(`导出成功: ${outputPath}`);
    console.log(`共导出 ${logs.length} 条审计记录`);
  } else if (format === 'errors') {
    const errors = getImportErrors();
    const outputPath = path.join(outputDir, `import_errors_${timestamp}.json`);
    exportToJson(errors, outputPath);
    console.log(`导出成功: ${outputPath}`);
    console.log(`共导出 ${errors.length} 条错误记录`);
  } else {
    console.log('导出格式:');
    console.log('  node src/scripts/export.js json [输出目录] [状态] - 导出JSON格式');
    console.log('  node src/scripts/export.js csv [输出目录] [状态]  - 导出CSV格式');
    console.log('  node src/scripts/export.js audit [输出目录]        - 导出审计日志');
    console.log('  node src/scripts/export.js errors [输出目录]       - 导出导入错误');
    console.log('');
    console.log('状态选项: pending (待复核), reviewed (已通过), rejected (已驳回)');
    console.log('示例: node src/scripts/export.js json data/exports reviewed');
  }
  
  process.exit(0);
}

module.exports = { exportOrders, exportToJson, exportToCsv };
