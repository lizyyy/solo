const { initializeDatabase } = require('../models/database');
const { getArrivalOrders, getArrivalOrderById } = require('../services/arrivalService');
const { getTemperatureRecordsByOrderId } = require('../services/temperatureService');
const { getPhotosByOrderId } = require('../services/photoService');
const { getAuditLogs } = require('../services/auditService');
const { getImportErrors } = require('../services/errorService');

function showHistory(options = {}) {
  initializeDatabase();
  
  const orders = getArrivalOrders(options);
  
  console.log('\n=== 历史到货单记录 ===');
  console.log(`共 ${orders.length} 条记录\n`);
  
  orders.forEach((order, index) => {
    const statusText = {
      'pending': '待复核',
      'reviewed': '已通过',
      'rejected': '已驳回'
    }[order.status] || order.status;
    
    console.log(`${index + 1}. [${statusText}] ${order.product_name}`);
    console.log(`   批号: ${order.batch_number} | 类型: ${order.product_type}`);
    console.log(`   数量: ${order.quantity} | 到货日期: ${order.arrival_date}`);
    console.log(`   签收人: ${order.receiver} | 操作人: ${order.operator} (${order.role})`);
    console.log('');
  });
  
  return orders;
}

function showStatistics() {
  initializeDatabase();
  
  const allOrders = getArrivalOrders();
  const pendingOrders = getArrivalOrders({ status: 'pending' });
  const reviewedOrders = getArrivalOrders({ status: 'reviewed' });
  const rejectedOrders = getArrivalOrders({ status: 'rejected' });
  
  const vaccineOrders = allOrders.filter(o => o.product_type === 'vaccine');
  const insulinOrders = allOrders.filter(o => o.product_type === 'insulin');
  
  const auditLogs = getAuditLogs();
  const importErrors = getImportErrors({ resolved: false });
  
  console.log('\n=== 系统统计 ===');
  console.log(`到货单总数: ${allOrders.length}`);
  console.log(`  - 待复核: ${pendingOrders.length}`);
  console.log(`  - 已通过: ${reviewedOrders.length}`);
  console.log(`  - 已驳回: ${rejectedOrders.length}`);
  console.log('');
  console.log(`产品类型分布:`);
  console.log(`  - 疫苗: ${vaccineOrders.length}`);
  console.log(`  - 胰岛素: ${insulinOrders.length}`);
  console.log('');
  console.log(`审计日志: ${auditLogs.length} 条`);
  console.log(`未解决导入错误: ${importErrors.length} 条`);
  
  return {
    total: allOrders.length,
    pending: pendingOrders.length,
    reviewed: reviewedOrders.length,
    rejected: rejectedOrders.length,
    vaccine: vaccineOrders.length,
    insulin: insulinOrders.length,
    auditLogs: auditLogs.length,
    importErrors: importErrors.length
  };
}

function searchByBatch(batchNumber) {
  initializeDatabase();
  
  const allOrders = getArrivalOrders();
  const matched = allOrders.filter(o => 
    o.batch_number.toLowerCase().includes(batchNumber.toLowerCase())
  );
  
  console.log(`\n=== 搜索批号 "${batchNumber}" ===`);
  console.log(`找到 ${matched.length} 条匹配记录\n`);
  
  matched.forEach((order, i) => {
    console.log(`${i + 1}. ${order.product_name} (${order.batch_number})`);
    console.log(`   ID: ${order.id}`);
    console.log(`   状态: ${order.status}`);
    console.log('');
  });
  
  return matched;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';
  
  if (command === 'list') {
    const status = args[1];
    const options = status ? { status } : {};
    showHistory(options);
    process.exit(0);
  }
  
  if (command === 'stat' || command === 'statistics') {
    showStatistics();
    process.exit(0);
  }
  
  if (command === 'search') {
    if (args.length < 2) {
      console.log('用法: node src/scripts/history.js search <批号>');
      process.exit(1);
    }
    searchByBatch(args[1]);
    process.exit(0);
  }
  
  if (command === 'detail') {
    if (args.length < 2) {
      console.log('用法: node src/scripts/history.js detail <订单ID>');
      process.exit(1);
    }
    const orderId = args[1];
    initializeDatabase();
    const order = getArrivalOrderById(orderId);
    if (!order) {
      console.log('订单不存在');
      process.exit(1);
    }
    const temps = getTemperatureRecordsByOrderId(orderId);
    const photos = getPhotosByOrderId(orderId);
    
    console.log('\n=== 订单详情 ===');
    console.log(`ID: ${order.id}`);
    console.log(`批号: ${order.batch_number}`);
    console.log(`产品: ${order.product_name} (${order.product_type})`);
    console.log(`数量: ${order.quantity}`);
    console.log(`到货日期: ${order.arrival_date}`);
    console.log(`签收人: ${order.receiver}`);
    console.log(`签名: ${order.signature}`);
    console.log(`破损状态: ${order.damage_status}`);
    if (order.damage_description) {
      console.log(`破损描述: ${order.damage_description}`);
    }
    console.log(`状态: ${order.status}`);
    console.log(`操作人: ${order.operator} (${order.role})`);
    console.log(`创建时间: ${order.created_at}`);
    
    if (temps.length > 0) {
      console.log(`\n温度记录 (${temps.length} 条):`);
      temps.forEach(t => console.log(`  - ${t.record_time}: ${t.temperature}°C`));
    }
    
    if (photos.length > 0) {
      console.log(`\n照片记录 (${photos.length} 条):`);
      photos.forEach(p => console.log(`  - [${p.photo_type}] ${p.photo_path}`));
    }
    
    process.exit(0);
  }
  
  if (command === 'audit') {
    const logs = getAuditLogs({ limit: 50 });
    console.log(`\n=== 最近审计日志 (最多50条) ===\n`);
    logs.forEach((log, i) => {
      console.log(`${i + 1}. ${log.created_at}`);
      console.log(`   操作: ${log.action} | 表: ${log.table_name || '-'} | 记录ID: ${log.record_id || '-'}`);
      console.log(`   操作人: ${log.operator} (${log.role})`);
      console.log('');
    });
    process.exit(0);
  }
  
  console.log('可用命令:');
  console.log('  list [状态]           - 列出历史记录 (状态: pending/reviewed/rejected)');
  console.log('  stat / statistics     - 显示统计信息');
  console.log('  search <批号>         - 按批号搜索');
  console.log('  detail <订单ID>       - 查看订单详情');
  console.log('  audit                 - 查看审计日志');
  process.exit(1);
}

module.exports = { showHistory, showStatistics, searchByBatch };
