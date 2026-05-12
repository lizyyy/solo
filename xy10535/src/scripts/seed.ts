import { ticketService } from '../services/ticketService';
import { transferService } from '../services/transferService';
import { refundService } from '../services/refundService';
import { validationService } from '../services/validationService';
import { now } from '../utils';
import type { Ticket } from '../types';

console.log('========================================');
console.log('  场馆票务核销 API - 初始化样例数据');
console.log('========================================\n');

const EVENT_ID = 'EVENT_2024_CONCERT';
const EVENT_NAME = '2024年度大型演唱会';

const OPERATOR = {
  operatorId: 'OP_ADMIN',
  operatorName: '系统管理员'
};

const GATE = {
  gateId: 'GATE_A1',
  gateName: 'A1号入口'
};

const users = [
  { id: 'U001', name: '张三' },
  { id: 'U002', name: '李四' },
  { id: 'U003', name: '王五' },
  { id: 'U004', name: '赵六' },
  { id: 'U005', name: '钱七' }
];

function logStep(step: string, data?: any) {
  console.log(`\n[${step}]`);
  if (data) {
    if (data.ticketCode) {
      console.log(`  票券: ${data.ticketCode}`);
      console.log(`  持有人: ${data.holderName}`);
    }
    if (data.status) {
      console.log(`  状态: ${data.status}`);
    }
  }
}

async function seed() {
  const tickets: Record<string, Ticket> = {};
  
  console.log('\n--- 1. 创建普通票券 ---');
  
  tickets['normal1'] = ticketService.createTicket({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    holderId: users[0].id,
    holderName: users[0].name,
    price: 380,
    ...OPERATOR
  });
  logStep('创建普通票', tickets['normal1']);
  
  tickets['normal2'] = ticketService.createTicket({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    holderId: users[1].id,
    holderName: users[1].name,
    price: 380,
    ...OPERATOR
  });
  logStep('创建普通票', tickets['normal2']);
  
  tickets['normal3'] = ticketService.createTicket({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    holderId: users[2].id,
    holderName: users[2].name,
    price: 380,
    ...OPERATOR
  });
  logStep('创建普通票', tickets['normal3']);
  
  tickets['normal4'] = ticketService.createTicket({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    holderId: users[3].id,
    holderName: users[3].name,
    price: 580,
    ...OPERATOR
  });
  logStep('创建普通票', tickets['normal4']);
  
  tickets['refundTest'] = ticketService.createTicket({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    holderId: users[4].id,
    holderName: users[4].name,
    price: 380,
    ...OPERATOR
  });
  logStep('创建退票测试票', tickets['refundTest']);
  
  console.log('\n--- 2. 创建套票 ---');
  
  const packageResult = ticketService.createPackageTicket({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    holderId: users[0].id,
    holderName: users[0].name,
    packageName: '家庭套票（3人）',
    ticketCount: 3,
    totalPrice: 900,
    ...OPERATOR
  });
  tickets['packageParent'] = packageResult.parentTicket;
  tickets['packageChild1'] = packageResult.childTickets[0];
  tickets['packageChild2'] = packageResult.childTickets[1];
  tickets['packageChild3'] = packageResult.childTickets[2];
  
  console.log(`  套票父票: ${tickets['packageParent'].ticketCode}`);
  console.log(`  子票1: ${tickets['packageChild1'].ticketCode} (序列: ${tickets['packageChild1'].packageSequence})`);
  console.log(`  子票2: ${tickets['packageChild2'].ticketCode} (序列: ${tickets['packageChild2'].packageSequence})`);
  console.log(`  子票3: ${tickets['packageChild3'].ticketCode} (序列: ${tickets['packageChild3'].packageSequence})`);
  
  console.log('\n--- 3. 票券支付 ---');
  
  for (const key of ['normal1', 'normal2', 'normal3', 'normal4', 'refundTest']) {
    ticketService.updateStatus(tickets[key].id, 'PAID', {
      ...OPERATOR,
      reason: '支付完成'
    });
    console.log(`  ${tickets[key].holderName} 支付完成: ${tickets[key].ticketCode}`);
  }
  ticketService.updateStatus(tickets['packageParent'].id, 'PAID', { ...OPERATOR, reason: '套票支付完成' });
  ticketService.updateStatus(tickets['packageChild1'].id, 'PAID', { ...OPERATOR, reason: '套票子票支付完成' });
  ticketService.updateStatus(tickets['packageChild2'].id, 'PAID', { ...OPERATOR, reason: '套票子票支付完成' });
  ticketService.updateStatus(tickets['packageChild3'].id, 'PAID', { ...OPERATOR, reason: '套票子票支付完成' });
  
  console.log('\n--- 4. 发起转赠 ---');
  
  const transfer = transferService.createTransfer({
    ticketId: tickets['normal2'].id,
    fromHolderId: users[1].id,
    fromHolderName: users[1].name,
    toHolderId: users[2].id,
    toHolderName: users[2].name,
    ...OPERATOR
  });
  console.log(`  转赠记录: ${transfer.id}`);
  console.log(`  ${users[1].name} -> ${users[2].name}`);
  
  console.log('\n--- 5. 完成转赠 ---');
  
  transferService.completeTransfer(transfer.id, OPERATOR);
  const updatedNormal2 = ticketService.findById(tickets['normal2'].id)!;
  console.log(`  转赠完成，当前持有人: ${updatedNormal2.holderName}`);
  
  console.log('\n--- 6. 申请退票 ---');
  
  const refundRequest = refundService.requestRefund({
    ticketId: tickets['refundTest'].id,
    holderId: users[4].id,
    reason: '行程变更无法参加',
    ...OPERATOR
  });
  console.log(`  退票申请: ${refundRequest.id}`);
  console.log(`  原因: ${refundRequest.reason}`);
  
  console.log('\n--- 7. 审批退票 ---');
  
  refundService.approveRefund(refundRequest.id, OPERATOR);
  const refundedTicket = ticketService.findById(tickets['refundTest'].id)!;
  console.log(`  退票完成，票券状态: ${refundedTicket.status}`);
  
  console.log('\n--- 8. 正常核销 ---');
  
  const result1 = validationService.validateTicket({
    ticketCode: tickets['normal1'].ticketCode,
    ...GATE,
    ...OPERATOR
  });
  console.log(`  核销 ${tickets['normal1'].ticketCode}:`);
  console.log(`    结果: ${result1.success ? '成功' : '失败'}`);
  if (result1.record) {
    console.log(`    状态: ${result1.record.status}`);
    console.log(`    闸口: ${result1.record.gateName}`);
  }
  
  console.log('\n--- 9. 转赠后核销 ---');
  
  const result2 = validationService.validateTicket({
    ticketCode: updatedNormal2.ticketCode,
    ...GATE,
    ...OPERATOR
  });
  console.log(`  核销 ${updatedNormal2.ticketCode} (转赠后):`);
  console.log(`    持有人: ${updatedNormal2.holderName}`);
  console.log(`    结果: ${result2.success ? '成功' : '失败'}`);
  if (result2.record) {
    console.log(`    原持有人: ${users[1].name} -> 现持有人: ${updatedNormal2.holderName}`);
  }
  
  console.log('\n--- 10. 套票部分入场 ---');
  
  const result3 = validationService.validateTicket({
    ticketCode: tickets['packageChild1'].ticketCode,
    ...GATE,
    ...OPERATOR
  });
  console.log(`  核销套票子票1 ${tickets['packageChild1'].ticketCode}:`);
  console.log(`    结果: ${result3.success ? '成功' : '失败'}`);
  
  const parentProgress = validationService.getPackageValidationProgress(tickets['packageParent']);
  console.log(`  套票进度: ${parentProgress?.used}/${parentProgress?.total} 已使用`);
  
  console.log('\n--- 11. 重复核销检测 ---');
  
  const result4 = validationService.validateTicket({
    ticketCode: tickets['normal1'].ticketCode,
    ...GATE,
    ...OPERATOR
  });
  console.log(`  重复核销 ${tickets['normal1'].ticketCode}:`);
  console.log(`    结果: ${result4.success ? '成功' : '失败（预期）'}`);
  console.log(`    状态: ${result4.record?.status}`);
  console.log(`    原因: ${result4.failureReason}`);
  
  console.log('\n--- 12. 退票拦截 ---');
  
  const result5 = validationService.validateTicket({
    ticketCode: refundedTicket.ticketCode,
    ...GATE,
    ...OPERATOR
  });
  console.log(`  核销退票票 ${refundedTicket.ticketCode}:`);
  console.log(`    票券状态: ${refundedTicket.status}`);
  console.log(`    结果: ${result5.success ? '成功' : '失败（预期）'}`);
  console.log(`    原因: ${result5.failureReason}`);
  
  console.log('\n--- 13. 离线核销包 ---');
  
  const offlinePkg = validationService.createOfflinePackage({
    ...GATE,
    ...OPERATOR,
    validHours: 8
  });
  console.log(`  创建离线包: ${offlinePkg.packageId}`);
  console.log(`  有效期至: ${new Date(offlinePkg.validUntil).toLocaleString()}`);
  
  console.log('\n--- 14. 模拟离线核销 ---');
  
  const offlineTime = now() - 1000 * 60 * 30;
  const offlineValidations = [
    {
      ticketCode: tickets['normal3'].ticketCode,
      gateId: GATE.gateId,
      validationTime: offlineTime
    },
    {
      ticketCode: 'TK-INVALID-001',
      gateId: GATE.gateId,
      validationTime: offlineTime + 1000
    }
  ];
  
  console.log(`  离线核销记录:`);
  offlineValidations.forEach((v, i) => {
    console.log(`    ${i + 1}. ${v.ticketCode} @ ${new Date(v.validationTime).toLocaleTimeString()}`);
  });
  
  console.log('\n--- 15. 上传离线包并补传 ---');
  
  const uploadResult = validationService.uploadOfflinePackage({
    packageId: offlinePkg.packageId,
    validations: offlineValidations,
    ...OPERATOR
  });
  
  console.log(`  处理结果:`);
  console.log(`    处理数量: ${uploadResult.processedCount}`);
  console.log(`    成功: ${uploadResult.successCount}`);
  console.log(`    失败: ${uploadResult.failedCount}`);
  uploadResult.results.forEach((r, i) => {
    console.log(`    ${i + 1}. ${r.ticketCode} - ${r.status}${r.reason ? ' (' + r.reason + ')' : ''}`);
  });
  
  console.log('\n========================================');
  console.log('  样例数据初始化完成！');
  console.log('========================================');
  console.log('\n创建的票券:');
  Object.entries(tickets).forEach(([key, ticket]) => {
    const current = ticketService.findById(ticket.id);
    console.log(`  ${key.padEnd(15)}: ${ticket.ticketCode} - ${ticket.holderName} (${current?.status})`);
  });
  
  console.log('\n活动统计:');
  const stats = validationService.getEventStats(EVENT_ID);
  console.log(`  总票数: ${stats.totalTickets}`);
  console.log(`  已入场: ${stats.validatedTickets}`);
  console.log(`  成功核销: ${stats.successValidations}`);
  console.log(`  失败核销: ${stats.failedValidations}`);
  console.log(`  重复核销: ${stats.duplicateValidations}`);
  console.log(`  在线核销: ${stats.onlineValidations}`);
  console.log(`  离线核销: ${stats.offlineValidations}`);
  
  console.log('\n提示: 启动服务后可通过以下接口查看详情:');
  console.log(`  GET /api/tickets/code/${tickets['normal1'].ticketCode}`);
  console.log(`  GET /api/tickets/${tickets['normal1'].id}/detail`);
  console.log(`  GET /api/validations/stats/event/${EVENT_ID}?eventName=${encodeURIComponent(EVENT_NAME)}`);
}

seed().catch(console.error);
