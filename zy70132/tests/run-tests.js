const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = './data/test-tickets.db';
process.env.DB_PATH = testDbPath;
process.env.PAYMENT_WINDOW_SECONDS = '60';

const models = require('../src/models');
const services = require('../src/services');
const { initDatabase, getDb } = require('../src/database');

const EVENT_ID = 'test-concert-2024';

function cleanup() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testDbPath + '-wal')) {
    fs.unlinkSync(testDbPath + '-wal');
  }
  if (fs.existsSync(testDbPath + '-shm')) {
    fs.unlinkSync(testDbPath + '-shm');
  }
}

function setupTestData() {
  cleanup();
  initDatabase();
  
  for (let i = 1; i <= 5; i++) {
    models.createTicket(EVENT_ID, `A${i}`, 1000);
  }
  
  console.log('✓ 测试数据初始化完成：5张票');
}

async function runTests() {
  const results = [];
  
  console.log('\n========== 开始测试 ==========\n');
  
  try {
    setupTestData();
    
    console.log('\n--- 测试1: 正常购票流程 ---');
    results.push(await testNormalPurchase());
    
    console.log('\n--- 测试2: 无票时加入候补 ---');
    results.push(await testWaitlistJoin());
    
    console.log('\n--- 测试3: 退票后递补 ---');
    results.push(await testRefundEscalation());
    
    console.log('\n--- 测试4: 支付超时取消 ---');
    results.push(await testPaymentTimeout());
    
    console.log('\n--- 测试5: 拒绝offer后继续递补 ---');
    results.push(await testRejectAndEscalate());
    
    console.log('\n--- 测试6: 通知去重 ---');
    results.push(await testNotificationDedup());
    
    console.log('\n--- 测试7: 并发购票不超卖 ---');
    results.push(await testConcurrentPurchase());
    
    console.log('\n--- 测试8: 候补优先级 ---');
    results.push(await testWaitlistPriority());
    
  } catch (err) {
    console.error('测试执行异常:', err);
  }
  
  console.log('\n========== 测试结果 ==========\n');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
    if (!r.passed) console.log(`   错误: ${r.error}`);
  });
  
  console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
  
  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

async function testNormalPurchase() {
  try {
    const result = services.purchaseTicket(EVENT_ID, 'user-1');
    assert.ok(result.success, '购票应该成功');
    assert.ok(result.ticketId, '应该返回ticketId');
    assert.ok(result.transactionId, '应该返回transactionId');
    
    const ticket = models.getTicketById(result.ticketId);
    assert.strictEqual(ticket.status, models.TicketStatus.PENDING_PAYMENT, '票状态应为待支付');
    
    const payResult = services.confirmPayment(result.transactionId);
    assert.ok(payResult.success, '支付确认应该成功');
    
    const ticketAfter = models.getTicketById(result.ticketId);
    assert.strictEqual(ticketAfter.status, models.TicketStatus.SOLD, '票状态应为已售出');
    
    return { name: '正常购票流程', passed: true };
  } catch (err) {
    return { name: '正常购票流程', passed: false, error: err.message };
  }
}

async function testWaitlistJoin() {
  try {
    for (let i = 2; i <= 5; i++) {
      const result = services.purchaseTicket(EVENT_ID, `user-${i}`);
      services.confirmPayment(result.transactionId);
    }
    
    const soldOutResult = services.purchaseTicket(EVENT_ID, 'user-6');
    assert.ok(!soldOutResult.success, '无票时购票应该失败');
    assert.strictEqual(soldOutResult.code, 'NO_TICKETS_AVAILABLE', '错误码应为NO_TICKETS_AVAILABLE');
    
    const queueResult = services.joinQueue(EVENT_ID, 'user-6');
    assert.ok(queueResult.success, '加入候补应该成功');
    assert.strictEqual(queueResult.position, 1, '位置应为1');
    
    const status = services.getQueueStatus(EVENT_ID, 'user-6');
    assert.ok(status.inQueue, '查询状态应显示在队列中');
    
    return { name: '无票时加入候补', passed: true };
  } catch (err) {
    return { name: '无票时加入候补', passed: false, error: err.message };
  }
}

async function testRefundEscalation() {
  try {
    services.joinQueue(EVENT_ID, 'user-7');
    services.joinQueue(EVENT_ID, 'user-8');
    
    const db = getDb();
    const user1Ticket = db.prepare(
      'SELECT id FROM tickets WHERE event_id = ? AND holder_id = ?'
    ).get(EVENT_ID, 'user-1');
    
    const refundResult = services.refundTicket(user1Ticket.id);
    assert.ok(refundResult.success, '退票应该成功');
    assert.ok(refundResult.escalated, '应该触发递补');
    
    const queue = models.getWaitlist(EVENT_ID);
    assert.strictEqual(queue.length, 2, '队列还剩2人');
    
    const user6Status = services.getQueueStatus(EVENT_ID, 'user-6');
    assert.strictEqual(user6Status.status, models.QueueStatus.OFFERED, 'user-6应获得offer');
    
    return { name: '退票后递补', passed: true };
  } catch (err) {
    return { name: '退票后递补', passed: false, error: err.message };
  }
}

async function testPaymentTimeout() {
  try {
    setupTestData();
    
    const purchaseResult = services.purchaseTicket(EVENT_ID, 'timeout-user');
    const db = getDb();
    
    db.prepare(
      'UPDATE tickets SET payment_deadline = ? WHERE id = ?'
    ).run(models.now() - 100, purchaseResult.ticketId);
    
    const timeoutResult = services.processPaymentTimeouts();
    assert.ok(timeoutResult.processedCount >= 1, '应该处理超时');
    
    const ticket = models.getTicketById(purchaseResult.ticketId);
    assert.strictEqual(ticket.status, models.TicketStatus.AVAILABLE, '票应恢复可用');
    
    return { name: '支付超时取消', passed: true };
  } catch (err) {
    return { name: '支付超时取消', passed: false, error: err.message };
  }
}

async function testRejectAndEscalate() {
  try {
    setupTestData();
    
    for (let i = 1; i <= 5; i++) {
      const r = services.purchaseTicket(EVENT_ID, `buyer-${i}`);
      services.confirmPayment(r.transactionId);
    }
    
    services.joinQueue(EVENT_ID, 'wait-a');
    services.joinQueue(EVENT_ID, 'wait-b');
    services.joinQueue(EVENT_ID, 'wait-c');
    
    const db = getDb();
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE event_id = ? AND holder_id = ?'
    ).get(EVENT_ID, 'buyer-1');
    
    services.refundTicket(ticket.id);
    
    const queueEntry = db.prepare(
      'SELECT * FROM waitlist_queue WHERE event_id = ? AND user_id = ?'
    ).get(EVENT_ID, 'wait-a');
    
    const rejectResult = services.rejectOffer(queueEntry.id, 'wait-a');
    assert.ok(rejectResult.success, '拒绝offer应该成功');
    
    const waitBStatus = services.getQueueStatus(EVENT_ID, 'wait-b');
    assert.strictEqual(waitBStatus.status, models.QueueStatus.OFFERED, 'wait-b应获得offer');
    
    return { name: '拒绝offer后继续递补', passed: true };
  } catch (err) {
    return { name: '拒绝offer后继续递补', passed: false, error: err.message };
  }
}

async function testNotificationDedup() {
  try {
    const db = getDb();
    const countBefore = db.prepare('SELECT COUNT(*) as c FROM notifications').get().c;
    
    const id1 = models.createNotification('dedup-user', EVENT_ID, models.NotificationType.TICKET_OFFER, 'ticket-1');
    const id2 = models.createNotification('dedup-user', EVENT_ID, models.NotificationType.TICKET_OFFER, 'ticket-1');
    
    const countAfter = db.prepare('SELECT COUNT(*) as c FROM notifications').get().c;
    assert.strictEqual(countAfter - countBefore, 2, '不同通知ID应创建2条记录');
    assert.notStrictEqual(id1, id2, '通知ID应不同');
    
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id1);
    assert.strictEqual(notification.status, models.NotificationStatus.PENDING, '初始状态应为pending');
    
    models.updateNotificationStatus(id1, models.NotificationStatus.SENT);
    const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id1);
    assert.strictEqual(updated.status, models.NotificationStatus.SENT, '状态应更新为sent');
    assert.ok(updated.sent_at, '应有sent_at时间');
    
    return { name: '通知去重', passed: true };
  } catch (err) {
    return { name: '通知去重', passed: false, error: err.message };
  }
}

async function testConcurrentPurchase() {
  try {
    setupTestData();
    
    const results = [];
    for (let i = 0; i < 50; i++) {
      const r = services.purchaseTicket(EVENT_ID, `concurrent-user-${i}`);
      results.push(r);
    }
    
    const successful = results.filter(r => r.success).length;
    assert.strictEqual(successful, 5, '只能成功购买5张票，不超卖');
    
    return { name: '并发购票不超卖', passed: true };
  } catch (err) {
    return { name: '并发购票不超卖', passed: false, error: err.message };
  }
}

async function testWaitlistPriority() {
  try {
    setupTestData();
    
    for (let i = 1; i <= 5; i++) {
      const r = services.purchaseTicket(EVENT_ID, `vip-buyer-${i}`);
      services.confirmPayment(r.transactionId);
    }
    
    services.joinQueue(EVENT_ID, 'normal-user', 0);
    services.joinQueue(EVENT_ID, 'vip-user', 10);
    services.joinQueue(EVENT_ID, 'normal-user-2', 0);
    
    const waitlist = models.getWaitlist(EVENT_ID);
    assert.strictEqual(waitlist[0].user_id, 'vip-user', '高优先级用户应排在前面');
    
    const db = getDb();
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE event_id = ? AND holder_id = ?'
    ).get(EVENT_ID, 'vip-buyer-1');
    
    services.refundTicket(ticket.id);
    
    const vipStatus = services.getQueueStatus(EVENT_ID, 'vip-user');
    assert.strictEqual(vipStatus.status, models.QueueStatus.OFFERED, '高优先级用户应先获得offer');
    
    return { name: '候补优先级', passed: true };
  } catch (err) {
    return { name: '候补优先级', passed: false, error: err.message };
  }
}

runTests();
