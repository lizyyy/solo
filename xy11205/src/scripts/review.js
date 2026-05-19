const { initializeDatabase } = require('../models/database');
const { getArrivalOrders, reviewArrivalOrder, getArrivalOrderById } = require('../services/arrivalService');
const { getTemperatureRecordsByOrderId } = require('../services/temperatureService');
const { getPhotosByOrderId } = require('../services/photoService');
const { getImportErrors } = require('../services/errorService');

function listPendingOrders() {
  initializeDatabase();
  const pendingOrders = getArrivalOrders({ status: 'pending' });
  
  console.log('\n=== 待复核到货单列表 ===');
  if (pendingOrders.length === 0) {
    console.log('暂无待复核记录');
    return;
  }
  
  pendingOrders.forEach((order, index) => {
    console.log(`\n${index + 1}. ID: ${order.id}`);
    console.log(`   批号: ${order.batch_number}`);
    console.log(`   产品: ${order.product_name} (${order.product_type})`);
    console.log(`   数量: ${order.quantity}`);
    console.log(`   到货日期: ${order.arrival_date}`);
    console.log(`   签收人: ${order.receiver}`);
    console.log(`   破损情况: ${order.damage_status} ${order.damage_description ? '- ' + order.damage_description : ''}`);
  });
  
  return pendingOrders;
}

function reviewOrder(orderId, status, operator, role) {
  initializeDatabase();
  
  if (!['reviewed', 'rejected'].includes(status)) {
    console.error('无效状态。使用: reviewed (通过) 或 rejected (驳回)');
    process.exit(1);
  }
  
  try {
    const result = reviewArrivalOrder(orderId, status, operator, role);
    console.log('\n=== 复核成功 ===');
    console.log(`订单ID: ${result.id}`);
    console.log(`状态: ${result.status === 'reviewed' ? '已通过' : '已驳回'}`);
    console.log(`复核人: ${operator} (${role})`);
    return result;
  } catch (error) {
    console.error('复核失败:', error.message);
    process.exit(1);
  }
}

function showOrderDetail(orderId) {
  initializeDatabase();
  
  const order = getArrivalOrderById(orderId);
  if (!order) {
    console.error('到货单不存在');
    process.exit(1);
  }
  
  const tempRecords = getTemperatureRecordsByOrderId(orderId);
  const photos = getPhotosByOrderId(orderId);
  
  console.log('\n=== 到货单详情 ===');
  console.log(`ID: ${order.id}`);
  console.log(`批号: ${order.batch_number}`);
  console.log(`产品类型: ${order.product_type}`);
  console.log(`产品名称: ${order.product_name}`);
  console.log(`数量: ${order.quantity}`);
  console.log(`到货日期: ${order.arrival_date}`);
  console.log(`签收人: ${order.receiver}`);
  console.log(`签名: ${order.signature}`);
  console.log(`破损状态: ${order.damage_status}`);
  if (order.damage_description) {
    console.log(`破损描述: ${order.damage_description}`);
  }
  console.log(`状态: ${order.status}`);
  
  console.log('\n--- 温度记录 ---');
  if (tempRecords.length === 0) {
    console.log('暂无温度记录');
  } else {
    tempRecords.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.record_time} - ${rec.temperature}°C (记录人: ${rec.recorder})`);
    });
  }
  
  console.log('\n--- 照片记录 ---');
  if (photos.length === 0) {
    console.log('暂无照片记录');
  } else {
    photos.forEach((photo, i) => {
      console.log(`${i + 1}. ${photo.photo_type} - ${photo.photo_path} (上传人: ${photo.uploaded_by})`);
    });
  }
  
  return { order, tempRecords, photos };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'list') {
    listPendingOrders();
    process.exit(0);
  }
  
  if (command === 'detail') {
    if (args.length < 2) {
      console.log('用法: node src/scripts/review.js detail <订单ID>');
      process.exit(1);
    }
    showOrderDetail(args[1]);
    process.exit(0);
  }
  
  if (command === 'approve' || command === 'reject') {
    if (args.length < 4) {
      console.log(`用法: node src/scripts/review.js ${command} <订单ID> <操作人> <角色>`);
      console.log(`示例: node src/scripts/review.js approve abc-123 王审核 reviewer`);
      process.exit(1);
    }
    const [, orderId, operator, role] = args;
    const status = command === 'approve' ? 'reviewed' : 'rejected';
    reviewOrder(orderId, status, operator, role);
    process.exit(0);
  }
  
  if (command === 'errors') {
    initializeDatabase();
    const errors = getImportErrors({ resolved: false });
    console.log('\n=== 未解决的导入错误 ===');
    if (errors.length === 0) {
      console.log('暂无未解决的错误');
    } else {
      errors.forEach((err, i) => {
        console.log(`\n${i + 1}. ID: ${err.id}`);
        console.log(`   类型: ${err.import_type}`);
        console.log(`   文件: ${err.source_file} (行 ${err.row_number})`);
        console.log(`   错误: ${err.error_message}`);
        console.log(`   建议: ${err.suggestion}`);
      });
    }
    process.exit(0);
  }
  
  console.log('可用命令:');
  console.log('  list                  - 列出待复核到货单');
  console.log('  detail <订单ID>       - 查看到货单详情');
  console.log('  approve <订单ID> <操作人> <角色>  - 通过复核');
  console.log('  reject <订单ID> <操作人> <角色>   - 驳回复核');
  console.log('  errors                - 查看未解决的导入错误');
  process.exit(1);
}

module.exports = { listPendingOrders, reviewOrder, showOrderDetail };
