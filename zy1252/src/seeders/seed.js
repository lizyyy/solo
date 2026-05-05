const { initTables, dropTables } = require('../config/initDatabase');
const { Order, OrderStatus } = require('../models/Order');
const { PaymentTransaction, TransactionStatus } = require('../models/PaymentTransaction');
const { IdempotencyKey, IdempotencyStatus } = require('../models/IdempotencyKey');
const { RequestFingerprint } = require('../models/RequestFingerprint');
const { CallbackEvent, CallbackType, CallbackStatus } = require('../models/CallbackEvent');
const { AuditLog, AuditAction } = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

const sampleUsers = [
  'user-001',
  'user-002',
  'user-003',
  'user-004',
  'user-005'
];

const sampleProducts = [
  { name: 'iPhone 15 Pro', price: 7999.00 },
  { name: 'MacBook Air M3', price: 8999.00 },
  { name: 'iPad Air', price: 4599.00 },
  { name: 'AirPods Pro 2', price: 1899.00 },
  { name: 'Apple Watch Series 9', price: 2999.00 },
  { name: '华为 Mate 60 Pro', price: 6999.00 },
  { name: '小米 14 Ultra', price: 5999.00 },
  { name: 'vivo X100 Pro', price: 4999.00 }
];

function generateRandomUser() {
  return sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
}

function generateRandomProduct() {
  return sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
}

async function seedData() {
  console.log('========================================');
  console.log('       开始初始化测试数据');
  console.log('========================================\n');

  console.log('1. 初始化数据库表...');
  await initTables();
  console.log('   ✓ 数据库表初始化完成\n');

  console.log('2. 创建示例订单...');
  const orders = [];
  
  for (let i = 0; i < 10; i++) {
    const user = generateRandomUser();
    const product = generateRandomProduct();
    
    const order = await Order.create({
      user_id: user,
      product_name: product.name,
      amount: product.price
    });
    
    orders.push(order);
    console.log(`   ✓ 创建订单: ${order.id.substring(0, 8)}... - ${product.name} - ¥${product.price}`);
  }
  console.log(`   共创建 ${orders.length} 个订单\n`);

  console.log('3. 创建示例交易记录...');
  const transactions = [];
  
  for (let i = 0; i < 8; i++) {
    const order = orders[i];
    const status = i < 6 ? TransactionStatus.SUCCESS : 
                   i === 6 ? TransactionStatus.FAILED : TransactionStatus.PENDING;
    
    const transaction = await PaymentTransaction.create({
      order_id: order.id,
      amount: order.amount,
      payment_method: ['alipay', 'wechat', 'credit_card'][i % 3],
      status: status,
      gateway_transaction_id: status !== TransactionStatus.PENDING 
        ? `GATEWAY_${uuidv4().substring(0, 12).toUpperCase()}`
        : null
    });
    
    transactions.push(transaction);
    
    if (status === TransactionStatus.SUCCESS) {
      await Order.updateStatus(order.id, OrderStatus.PAID);
    }
    
    const statusText = status === TransactionStatus.SUCCESS ? '成功' :
                       status === TransactionStatus.FAILED ? '失败' : '处理中';
    console.log(`   ✓ 创建交易: ${transaction.id.substring(0, 8)}... - ${statusText} - ¥${transaction.amount}`);
  }
  console.log(`   共创建 ${transactions.length} 笔交易\n`);

  console.log('4. 创建示例幂等键记录...');
  const idempotencyKeys = [];
  
  const scenarios = [
    { status: IdempotencyStatus.SUCCESS, path: '/api/orders', method: 'POST', userId: 'seed-user-1', amount: 1000.00 },
    { status: IdempotencyStatus.SUCCESS, path: '/api/payments', method: 'POST', userId: 'seed-user-2', amount: 2000.00 },
    { status: IdempotencyStatus.PROCESSING, path: '/api/payments', method: 'POST', userId: 'seed-user-3', amount: 3000.00 },
    { status: IdempotencyStatus.CONFLICT, path: '/api/orders', method: 'POST', userId: 'seed-user-4', amount: 4000.00 },
    { status: IdempotencyStatus.FAILED, path: '/api/payments/callback', method: 'POST', userId: 'seed-user-5', amount: 5000.00 }
  ];
  
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const key = `seed-test-${uuidv4().substring(0, 8)}`;
    
    const idempotencyKey = await IdempotencyKey.create({
      key: key,
      request_path: scenario.path,
      request_method: scenario.method,
      status: scenario.status,
      response_data: scenario.status === IdempotencyStatus.SUCCESS ? {
        success: true,
        code: 'SEED_DATA',
        message: '示例幂等记录'
      } : null
    });
    
    idempotencyKeys.push(idempotencyKey);
    
    const requestBody = { user_id: scenario.userId, amount: scenario.amount };
    const fingerprint = RequestFingerprint.generateFingerprint(
      scenario.path,
      scenario.method,
      requestBody,
      {},
      scenario.userId
    );
    
    await RequestFingerprint.create({
      idempotency_key_id: idempotencyKey.id,
      fingerprint: fingerprint,
      request_body_hash: RequestFingerprint.generateHash(requestBody)
    });
    
    const statusText = scenario.status === IdempotencyStatus.SUCCESS ? '成功' :
                       scenario.status === IdempotencyStatus.PROCESSING ? '处理中' :
                       scenario.status === IdempotencyStatus.CONFLICT ? '冲突' : '失败';
    console.log(`   ✓ 创建幂等键: ${key} - ${scenario.method} ${scenario.path} - ${statusText}`);
  }
  console.log(`   共创建 ${idempotencyKeys.length} 条幂等记录\n`);

  console.log('5. 创建示例回调事件...');
  const callbacks = [];
  
  if (transactions.length > 0) {
    const successfulTx = transactions.filter(t => t.status === TransactionStatus.SUCCESS);
    
    for (let i = 0; i < Math.min(successfulTx.length, 3); i++) {
      const tx = successfulTx[i];
      
      const callback = await CallbackEvent.create({
        order_id: tx.order_id,
        transaction_id: tx.id,
        callback_type: CallbackType.PAYMENT_SUCCESS,
        callback_data: {
          gateway_transaction_id: tx.gateway_transaction_id,
          amount: tx.amount,
          status: 'success',
          payment_time: new Date().toISOString()
        },
        status: i === 0 ? CallbackStatus.PROCESSED : 
                i === 1 ? CallbackStatus.DUPLICATE : CallbackStatus.RECEIVED
      });
      
      callbacks.push(callback);
      
      const statusText = callback.status === CallbackStatus.PROCESSED ? '已处理' :
                         callback.status === CallbackStatus.DUPLICATE ? '重复' : '已接收';
      console.log(`   ✓ 创建回调: ${callback.id.substring(0, 8)}... - ${callback.callback_type} - ${statusText}`);
    }
  }
  console.log(`   共创建 ${callbacks.length} 条回调记录\n`);

  console.log('6. 创建示例审计日志...');
  
  const auditActions = [
    { action: AuditAction.ORDER_CREATE, resource_type: 'order', resource_id: orders[0]?.id },
    { action: AuditAction.PAYMENT_SUCCESS, resource_type: 'payment_transaction', resource_id: transactions[0]?.id },
    { action: AuditAction.CALLBACK_RECEIVE, resource_type: 'callback_event', resource_id: callbacks[0]?.id },
    { action: AuditAction.IDEMPOTENT_HIT, resource_type: 'idempotency_key', resource_id: idempotencyKeys[0]?.id },
    { action: AuditAction.IDEMPOTENT_CONFLICT, resource_type: 'idempotency_key', resource_id: idempotencyKeys[3]?.id },
    { action: AuditAction.ORDER_UPDATE, resource_type: 'order', resource_id: orders[1]?.id }
  ];
  
  for (const audit of auditActions) {
    await AuditLog.create({
      user_id: generateRandomUser(),
      action: audit.action,
      resource_type: audit.resource_type,
      resource_id: audit.resource_id,
      ip_address: '192.168.1.' + Math.floor(Math.random() * 255),
      user_agent: 'seed-script/1.0',
      details: {
        source: 'seed_data',
        timestamp: new Date().toISOString()
      }
    });
  }
  console.log(`   共创建 ${auditActions.length} 条审计日志\n`);

  console.log('========================================');
  console.log('       测试数据初始化完成！');
  console.log('========================================\n');
  console.log('统计数据:');
  console.log(`  - 订单数: ${await Order.count()}`);
  console.log(`  - 交易数: ${await PaymentTransaction.count()}`);
  console.log(`  - 幂等记录数: ${await IdempotencyKey.count()}`);
  console.log(`  - 回调事件数: ${await CallbackEvent.count()}`);
  console.log(`  - 审计日志数: ${await AuditLog.count()}`);
  console.log(`  - 请求指纹数: ${await RequestFingerprint.count()}\n`);
  console.log('提示: 运行 npm start 启动服务，然后可以测试 API 接口');
  console.log('========================================\n');
}

async function main() {
  const args = process.argv.slice(2);
  const shouldDrop = args.includes('--drop') || args.includes('-d');
  
  if (shouldDrop) {
    console.log('⚠️  警告: 将删除所有现有数据并重新初始化\n');
    await dropTables();
    console.log('✓ 已删除所有表\n');
  }
  
  await seedData();
}

if (require.main === module) {
  main().catch(error => {
    console.error('初始化数据失败:', error);
    process.exit(1);
  });
}

module.exports = { seedData };
