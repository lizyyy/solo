process.env.DB_PATH = './data/test-tickets.db';

const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.env.DB_PATH);
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}
if (fs.existsSync(dbPath + '-shm')) {
  fs.unlinkSync(dbPath + '-shm');
}
if (fs.existsSync(dbPath + '-wal')) {
  fs.unlinkSync(dbPath + '-wal');
}

const { createShow, createTier, getAvailable } = require('../../src/services/inventory');
const { createOrder, payOrder, refundOrder, getOrder, listOrders } = require('../../src/services/order');
const { getQueueStatus, processQueueForRelease, listQueue } = require('../../src/services/queue');
const { runCompensation, listTasks, createInventoryRestoreTask } = require('../../src/services/compensation');
const { getShowSalesReport, getSystemReport } = require('../../src/services/report');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
    errors.push(message);
  }
}

function section(title) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(50)}\n`);
}

function run() {
  console.log('\n' + '#'.repeat(60));
  console.log('#   演出票务限购 API - 端到端测试');
  console.log('#'.repeat(60));

  section('1. 基础数据准备 - 创建演出和票档');

  const showId = createShow({
    name: '周杰伦「嘉年华」世界巡回演唱会 - 北京站',
    description: '2024 年度最期待演唱会',
    start_time: '2024-12-20 19:30:00',
    venue: '北京鸟巢体育场'
  });
  assert(showId && showId.length > 0, '演出创建成功');

  const vipTierId = createTier(showId, {
    name: 'VIP 内场票',
    price: 288800,
    total_quantity: 10,
    per_id_card_limit: 2,
    per_account_limit: 4,
    per_payment_limit: 2
  });
  assert(vipTierId && vipTierId.length > 0, 'VIP 票档创建成功（10 张）');

  const normalTierId = createTier(showId, {
    name: '普通看台票',
    price: 88800,
    total_quantity: 5,
    per_id_card_limit: 2,
    per_account_limit: 2,
    per_payment_limit: 1
  });
  assert(normalTierId && normalTierId.length > 0, '普通票档创建成功（5 张）');

  section('2. 主流程测试 - 正常购票');

  console.log('  用户 A（账号 user_001，证件 110101199001011234）购买 1 张 VIP 票');
  const order1 = createOrder({
    tierId: vipTierId,
    accountId: 'user_001',
    idCardNo: '110101199001011234',
    paymentChannel: 'alipay_001',
    quantity: 1,
    holders: [{ name: '张三', idCard: '110101199001011234' }]
  });
  assert(order1.success === true, '下单成功');
  assert(order1.order && order1.order.id, '订单 ID 已生成');
  assert(order1.order.status === 'pending_payment', '订单状态为待支付');

  const orderId1 = order1.order.id;

  console.log('  用户 A 完成支付');
  const pay1 = payOrder(orderId1);
  assert(pay1.success === true, '支付成功');
  assert(pay1.order.status === 'paid', '订单状态变为已支付');
  assert(pay1.order.tickets.length === 1, '生成 1 张电子票');

  const avail1 = getAvailable(vipTierId);
  assert(avail1.available === 9, 'VIP 库存从 10 减到 9（已售 1 张）');

  section('3. 限购规则测试 - 证件号限购');

  console.log('  用户 A 再买 2 张 VIP 票（已买 1 张，证件限购 2 张）');
  const order2 = createOrder({
    tierId: vipTierId,
    accountId: 'user_001',
    idCardNo: '110101199001011234',
    paymentChannel: 'alipay_001',
    quantity: 2
  });
  assert(order2.success === false, '下单被拦截');
  assert(order2.code === 'LIMIT_ID_CARD', '拦截原因：证件号限购');
  assert(order2.reason.includes('已购买 1 张'), '错误信息包含已购数量');

  console.log('  用户 A 改买 1 张 VIP 票（累计 2 张，刚好用满）');
  const order3 = createOrder({
    tierId: vipTierId,
    accountId: 'user_001',
    idCardNo: '110101199001011234',
    paymentChannel: 'alipay_001',
    quantity: 1
  });
  assert(order3.success === true, '下单成功（累计 2 张，符合限购）');
  payOrder(order3.order.id);

  const avail2 = getAvailable(vipTierId);
  assert(avail2.sold === 2, 'VIP 已售出 2 张');

  section('4. 限购规则测试 - 支付渠道限购');

  console.log('  用户 B（新账号新证件）用支付宝已被 user_A 用渠道购买');
  const order4 = createOrder({
    tierId: vipTierId,
    accountId: 'user_002',
    idCardNo: '110101199001011235',
    paymentChannel: 'alipay_001',
    quantity: 1
  });
  assert(order4.success === false, '下单被拦截');
  assert(order4.code === 'LIMIT_PAYMENT', '拦截原因：支付渠道限购');

  console.log('  用户 B 换用微信支付');
  const order5 = createOrder({
    tierId: vipTierId,
    accountId: 'user_002',
    idCardNo: '110101199001011235',
    paymentChannel: 'wechat_001',
    quantity: 1
  });
  assert(order5.success === true, '下单成功（换支付渠道）');
  payOrder(order5.order.id);

  section('5. 限购规则测试 - 账号限购');

  console.log('  用户 B 继续用新证件新渠道，测试账号限购（默认 4 张）');
  const ordersToBuy = [];
  for (let i = 0; i < 3; i++) {
    const result = createOrder({
      tierId: vipTierId,
      accountId: 'user_002',
      idCardNo: `11010119900101200${i}`,
      paymentChannel: `wechat_${100 + i}`,
      quantity: 1
    });
    if (result.success) {
      payOrder(result.order.id);
      ordersToBuy.push(result);
    }
  }
  assert(ordersToBuy.length === 3, '用户 B 又买了 3 张（累计 4 张）');

  console.log('  用户 B 尝试第 5 张');
  const order6 = createOrder({
    tierId: vipTierId,
    accountId: 'user_002',
    idCardNo: '110101199001013000',
    paymentChannel: 'wechat_200',
    quantity: 1
  });
  assert(order6.success === false, '下单被拦截');
  assert(order6.code === 'LIMIT_ACCOUNT', '拦截原因：账号限购（4 张上限）');

  section('6. 候补队列测试 - 售罄后自动候补');

  const avail3 = getAvailable(vipTierId);
  console.log(`  当前 VIP 库存: 总 ${avail3.total} / 已售 ${avail3.sold} / 可用 ${avail3.available}`);

  console.log('  用户 C（新用户）购买剩余的全部 VIP 票');
  const remaining = avail3.available;
  for (let i = 0; i < remaining; i++) {
    const result = createOrder({
      tierId: vipTierId,
      accountId: `user_${100 + i}`,
      idCardNo: `11010119900101${4000 + i}`,
      paymentChannel: `alipay_${400 + i}`,
      quantity: 1
    });
    if (result.success) payOrder(result.order.id);
  }

  const avail4 = getAvailable(vipTierId);
  assert(avail4.available === 0, 'VIP 票已售罄');

  console.log('  用户 D 在售罄后尝试购票');
  const order7 = createOrder({
    tierId: vipTierId,
    accountId: 'user_queued_001',
    idCardNo: '110101199001015001',
    paymentChannel: 'alipay_501',
    quantity: 1
  });
  assert(order7.success === false, '库存不足');
  assert(order7.code === 'OUT_OF_STOCK', '状态码正确');
  assert(order7.action === '已加入候补队列', '自动加入候补队列');
  assert(order7.queue && order7.queue.position === 1, '候补位置第 1 位');

  const queueId1 = order7.queue.queueId;

  console.log('  用户 E 也来候补');
  const order8 = createOrder({
    tierId: vipTierId,
    accountId: 'user_queued_002',
    idCardNo: '110101199001015002',
    paymentChannel: 'alipay_502',
    quantity: 1
  });
  assert(order8.queue.position === 2, '用户 E 候补位置第 2 位');

  const queueStatus = getQueueStatus(queueId1);
  assert(queueStatus.status === 'waiting', '候补状态为等待中');
  assert(queueStatus.peopleAhead === 0, '用户 D 前面 0 人');

  section('7. 退票回补测试 - 退票后自动匹配候补');

  console.log('  用户 A 退票 1 张 VIP 票');
  const refundResult = refundOrder(orderId1, '用户临时有事');
  assert(refundResult.success === true, '退票成功');
  assert(refundResult.order.status === 'refunded', '订单状态变为已退票');
  assert(refundResult.order.refundAmount === '¥2888.00', '退款金额正确');

  const queueAfter = listQueue(vipTierId);
  const matchedCount = queueAfter.filter(q => q.status === 'matched').length;
  assert(matchedCount === 1, '退票释放的票匹配给了 1 位候补用户');
  assert(refundResult.matchedUsers.length === 1, '返回了匹配的用户信息');

  console.log('  检查退票释放的库存是否正确处理');
  const avail5 = getAvailable(vipTierId);
  assert(avail5.sold === 10, '已售数量仍为 10（退票 1 张后，候补用户立即匹配了 1 张）');
  assert(avail5.available === 0, '可用库存仍为 0（候补匹配消费了退票）');

  section('8. 风控拦截测试');

  console.log('  被拉黑账号尝试购票');
  const order9 = createOrder({
    tierId: vipTierId,
    accountId: 'risk_account_001',
    idCardNo: '110101199001019000',
    paymentChannel: 'alipay_900',
    quantity: 1
  });
  assert(order9.success === false, '下单被拦截');
  assert(order9.code === 'RISK_BLOCKED_ACCOUNT', '拦截原因：账号黑名单');
  assert(order9.action === '风控拦截', '标记为风控拦截');

  console.log('  单次购买数量过多');
  const order10 = createOrder({
    tierId: normalTierId,
    accountId: 'user_normal_001',
    idCardNo: '110101199001019001',
    paymentChannel: 'alipay_901',
    quantity: 11
  });
  assert(order10.success === false, '下单被拦截');
  assert(order10.code === 'RISK_QUANTITY_EXCESS', '拦截原因：单次数量过多');

  section('9. 补偿任务测试 - 失败重试');

  console.log('  模拟创建一个补偿任务（库存回补）');
  const taskId = createInventoryRestoreTask(vipTierId, 1, 'test_ref_order');
  assert(taskId && taskId.length > 0, '补偿任务创建成功');

  const pendingTasks = listTasks('pending');
  assert(pendingTasks.length >= 1, '存在待处理的补偿任务');

  console.log('  执行补偿任务');
  const compResult = runCompensation(5);
  assert(compResult.processed >= 1, '至少处理了 1 个任务');

  const successTasks = listTasks('success');
  assert(successTasks.length >= 1, '有任务执行成功');

  section('10. 销售报表测试');

  console.log('  查看演出销售报表');
  const report = getShowSalesReport(showId);
  assert(report !== null, '报表生成成功');
  assert(report.show.name.includes('周杰伦'), '演出名称正确');
  assert(report.summary.soldTickets >= 8, '已售出 >= 8 张票');
  assert(report.summary.totalRevenue.includes('¥'), '营收金额格式化正确');
  assert(report.tiers.length === 2, '包含 2 个票档数据');
  assert(report.orderStatus.length > 0, '包含订单状态统计');

  console.log('  查看系统总览报表');
  const sysReport = getSystemReport();
  assert(sysReport.summary.activeShows === 1, '1 个活跃演出');
  assert(sysReport.orders.byStatus.length > 0, '包含订单状态统计');
  assert(sysReport.queue.byStatus.length >= 0, '包含候补队列统计');
  assert(sysReport.compensation.byStatus.length > 0, '包含补偿任务统计');

  section('测试结果汇总');

  console.log(`\n  通过: ${passed} 项`);
  console.log(`  失败: ${failed} 项`);
  
  if (errors.length > 0) {
    console.log('\n  失败详情:');
    errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
    process.exit(1);
  } else {
    console.log('\n  ✓ 所有测试通过！');
    console.log('\n  验证的关键场景:');
    console.log('    1. 演出和票档创建');
    console.log('    2. 正常购票流程（下单 -> 支付）');
    console.log('    3. 证件号限购拦截');
    console.log('    4. 支付渠道限购拦截');
    console.log('    5. 账号限购拦截');
    console.log('    6. 售罄后自动加入候补队列');
    console.log('    7. 退票后库存回补 + 候补自动匹配');
    console.log('    8. 风控黑名单拦截');
    console.log('    9. 超额购买风控拦截');
    console.log('    10. 补偿任务创建和执行');
    console.log('    11. 销售报表生成');
    process.exit(0);
  }
}

run();
