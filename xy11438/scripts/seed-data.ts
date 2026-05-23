import { initDatabase, closeDatabase } from '../src/database';
import { OrderCalendar, CleaningMessage, MaintenanceNote, ApprovalEmail, SupplierStatement } from '../src/types';

const BASE_DATE = '2024-01';

const rooms = ['101', '102', '103', '104', '105', '201', '202', '203'];
const cleaners = ['张阿姨', '李阿姨', '王阿姨', '赵阿姨'];
const guests = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];

function generateOrders(): OrderCalendar[] {
  const orders: OrderCalendar[] = [];
  
  orders.push({
    orderId: 'ORD-2024-001',
    roomId: '101',
    guestName: '张三',
    checkInDate: '2024-01-10',
    checkOutDate: '2024-01-11',
    nights: 1,
    isContinuousStay: false,
    linenChangeRequired: true
  });

  orders.push({
    orderId: 'ORD-2024-002',
    roomId: '102',
    guestName: '李四',
    checkInDate: '2024-01-10',
    checkOutDate: '2024-01-12',
    nights: 2,
    isContinuousStay: true,
    linenChangeRequired: false
  });

  orders.push({
    orderId: 'ORD-2024-003',
    roomId: '103',
    guestName: '王五',
    checkInDate: '2024-01-11',
    checkOutDate: '2024-01-14',
    nights: 3,
    isContinuousStay: true,
    linenChangeRequired: true
  });

  orders.push({
    orderId: 'ORD-2024-004',
    roomId: '201',
    guestName: '',
    checkInDate: '2024-01-11',
    checkOutDate: '2024-01-12',
    nights: 1,
    isContinuousStay: false,
    linenChangeRequired: true
  });

  orders.push({
    orderId: 'ORD-2024-005',
    roomId: '101',
    guestName: '钱七',
    checkInDate: '2024-01-12',
    checkOutDate: '2024-01-14',
    nights: 5,
    isContinuousStay: true,
    linenChangeRequired: true
  });

  orders.push({
    orderId: 'ORD-2024-006',
    roomId: '104',
    guestName: '孙八',
    checkInDate: '2024-01-12',
    checkOutDate: '2024-01-13',
    nights: 1,
    isContinuousStay: false,
    linenChangeRequired: true
  });

  return orders;
}

function generateCleaningMessages(): CleaningMessage[] {
  const messages: CleaningMessage[] = [];

  messages.push({
    messageId: 'CLN-2024-001',
    roomId: '101',
    cleanerName: '张阿姨',
    scheduledDate: '2024-01-10',
    scheduledTime: '14:00',
    cleaningType: 'checkout',
    status: 'completed',
    completedAt: '2024-01-10T15:30:00Z',
    qualityScore: 95,
    issuesReported: []
  });

  messages.push({
    messageId: 'CLN-2024-002',
    roomId: '102',
    cleanerName: '李阿姨',
    scheduledDate: '2024-01-10',
    scheduledTime: '15:00',
    cleaningType: 'daily',
    status: 'completed',
    completedAt: '2024-01-10T16:00:00Z',
    qualityScore: 88
  });

  messages.push({
    messageId: 'CLN-2024-003',
    roomId: '102',
    cleanerName: '李阿姨',
    scheduledDate: '2024-01-11',
    scheduledTime: '10:00',
    cleaningType: 'checkout',
    status: 'completed',
    completedAt: '2024-01-11T11:30:00Z',
    qualityScore: 90
  });

  messages.push({
    messageId: 'CLN-2024-004',
    roomId: '103',
    cleanerName: '王阿姨',
    scheduledDate: '2024-01-11',
    cleaningType: 'linen_change',
    status: 'in_progress'
  });

  messages.push({
    messageId: 'CLN-2024-005',
    roomId: '101',
    cleanerName: '赵阿姨',
    scheduledDate: '2024-01-12',
    scheduledTime: '14:00',
    cleaningType: 'checkout',
    status: 'completed',
    completedAt: '2024-01-12T15:00:00Z',
    qualityScore: 92
  });

  messages.push({
    messageId: 'CLN-2024-006',
    roomId: '103',
    cleanerName: '',
    scheduledDate: '2024-01-12',
    cleaningType: 'daily',
    status: 'scheduled'
  });

  messages.push({
    messageId: 'CLN-2024-007',
    roomId: '201',
    cleanerName: '张阿姨',
    scheduledDate: '2024-01-11',
    scheduledTime: '13:00',
    cleaningType: 'checkout',
    status: 'completed',
    completedAt: '2024-01-11T14:20:00Z',
    qualityScore: 85
  });

  return messages;
}

function generateMaintenanceNotes(): MaintenanceNote[] {
  const notes: MaintenanceNote[] = [];

  notes.push({
    noteId: 'MNT-2024-001',
    roomId: '101',
    reportedBy: '张阿姨',
    reportedAt: '2024-01-10T15:30:00Z',
    issueType: 'plumbing',
    description: '淋浴头漏水',
    priority: 'medium',
    status: 'reported'
  });

  notes.push({
    noteId: 'MNT-2024-002',
    roomId: '102',
    reportedBy: '前台小李',
    reportedAt: '2024-01-11T09:00:00Z',
    issueType: 'electrical',
    description: '床头灯不亮',
    priority: 'low',
    status: 'resolved',
    resolvedAt: '2024-01-11T14:00:00Z',
    resolution: '更换灯泡'
  });

  notes.push({
    noteId: 'MNT-2024-003',
    roomId: '103',
    reportedBy: '',
    reportedAt: '2024-01-11T10:00:00Z',
    issueType: 'other',
    description: '窗帘轨道损坏',
    priority: 'high',
    status: 'assigned'
  });

  notes.push({
    noteId: 'MNT-2024-004',
    roomId: '201',
    reportedBy: '王五',
    reportedAt: '2024-01-11T16:00:00Z',
    issueType: 'appliance',
    description: '空调不制冷',
    priority: 'urgent',
    status: 'resolved',
    resolvedAt: '2024-01-11T18:30:00Z'
  });

  return notes;
}

function generateApprovalEmails(): ApprovalEmail[] {
  const emails: ApprovalEmail[] = [];

  emails.push({
    emailId: 'APV-2024-001',
    requestType: 'refund',
    requester: '前台小李',
    approver: '店长',
    requestedAt: '2024-01-10T10:00:00Z',
    approvedAt: '2024-01-10T11:00:00Z',
    status: 'approved',
    amount: 100,
    reason: '客人投诉房间异味，申请部分退款',
    relatedOrderId: 'ORD-2024-001',
    relatedRoomId: '101'
  });

  emails.push({
    emailId: 'APV-2024-002',
    requestType: 'maintenance',
    requester: '维修工老刘',
    requestedAt: '2024-01-11T15:00:00Z',
    status: 'pending',
    amount: 350,
    reason: '空调维修费用审批',
    relatedOrderId: 'ORD-2024-003',
    relatedRoomId: '201'
  });

  emails.push({
    emailId: 'APV-2024-003',
    requestType: 'discount',
    requester: '前台小王',
    approver: '店长',
    requestedAt: '2024-01-12T09:00:00Z',
    approvedAt: '2024-01-12T09:30:00Z',
    status: 'approved',
    reason: 'VIP客户折扣',
    relatedOrderId: 'ORD-2024-006',
    relatedRoomId: '104'
  });

  emails.push({
    emailId: 'APV-2024-004',
    requestType: 'refund',
    requester: '前台小李',
    requestedAt: '2024-01-12T14:00:00Z',
    status: 'pending',
    amount: -50,
    reason: '测试异常金额',
    relatedRoomId: '101'
  });

  return emails;
}

function generateSupplierStatement(): SupplierStatement {
  return {
    statementId: 'STMT-2024-01',
    supplierName: '洁净保洁服务公司',
    periodStart: '2024-01-10',
    periodEnd: '2024-01-14',
    items: [
      {
        itemId: 'ITEM-001',
        description: '101退房保洁',
        roomId: '101',
        date: '2024-01-10',
        quantity: 1,
        unitPrice: 80,
        subtotal: 80
      },
      {
        itemId: 'ITEM-002',
        description: '102日常保洁',
        roomId: '102',
        date: '2024-01-10',
        quantity: 1,
        unitPrice: 50,
        subtotal: 50
      },
      {
        itemId: 'ITEM-003',
        description: '102退房保洁',
        roomId: '102',
        date: '2024-01-11',
        quantity: 1,
        unitPrice: 80,
        subtotal: 80
      },
      {
        itemId: 'ITEM-004',
        description: '103换布草',
        roomId: '103',
        date: '2024-01-11',
        quantity: 1,
        unitPrice: 30,
        subtotal: 60
      },
      {
        itemId: 'ITEM-005',
        description: '101退房保洁',
        roomId: '101',
        date: '2024-01-12',
        quantity: 1,
        unitPrice: 80,
        subtotal: 80
      },
      {
        itemId: 'ITEM-006',
        description: '999未知房间保洁',
        roomId: '999',
        date: '2024-01-12',
        quantity: 1,
        unitPrice: 50,
        subtotal: 50
      }
    ],
    totalAmount: 400,
    status: 'submitted'
  };
}

async function main() {
  console.log('=== 民宿保洁排班验收回放链路 - 造数脚本 ===\n');

  await initDatabase();

  const orders = generateOrders();
  console.log(`📋 生成 ${orders.length} 条订单日历数据`);
  orders.forEach(o => {
    const flag = o.guestName === '' || o.nights === 5 ? '⚠️' : '✅';
    console.log(`  ${flag} ${o.orderId}: 房间${o.roomId} ${o.guestName || '(缺姓名)'} ${o.nights}晚`);
  });

  const cleanings = generateCleaningMessages();
  console.log(`\n🧹 生成 ${cleanings.length} 条保洁群消息数据`);
  cleanings.forEach(c => {
    const flag = c.cleanerName === '' || c.status !== 'completed' ? '⚠️' : '✅';
    console.log(`  ${flag} ${c.messageId}: 房间${c.roomId} ${c.cleanerName || '(缺保洁员)'} ${c.cleaningType} ${c.status}`);
  });

  const maintenances = generateMaintenanceNotes();
  console.log(`\n🔧 生成 ${maintenances.length} 条维修备注数据`);
  maintenances.forEach(m => {
    const flag = m.reportedBy === '' || (m.status === 'resolved' && !m.resolution) ? '⚠️' : '✅';
    console.log(`  ${flag} ${m.noteId}: 房间${m.roomId} ${m.issueType} ${m.status}`);
  });

  const approvals = generateApprovalEmails();
  console.log(`\n📧 生成 ${approvals.length} 条审批邮件数据`);
  approvals.forEach(a => {
    const flag = (a.amount !== undefined && a.amount < 0) || (a.status === 'approved' && !a.approver) ? '⚠️' : '✅';
    console.log(`  ${flag} ${a.emailId}: ${a.requestType} ¥${a.amount} ${a.status}`);
  });

  const statement = generateSupplierStatement();
  console.log(`\n📊 生成供应商对账单数据`);
  console.log(`  ${statement.statementId}: ${statement.supplierName}`);
  console.log(`  期间: ${statement.periodStart} ~ ${statement.periodEnd}`);
  console.log(`  明细: ${statement.items.length}条, 总金额: ¥${statement.totalAmount}`);
  statement.items.forEach((item, idx) => {
    const flag = item.roomId === '999' || Math.abs(item.quantity * item.unitPrice - item.subtotal) > 0.01 ? '⚠️' : '  ';
    console.log(`    ${flag} ${item.itemId}: 房间${item.roomId} ${item.date} ¥${item.subtotal}`);
  });

  console.log('\n=== 脏数据场景说明 ===');
  console.log('1. ❌ 缺字段: ORD-2024-004(缺客人姓名), CLN-2024-006(缺保洁员), MNT-2024-003(缺上报人)');
  console.log('2. ❌ 数量冲突: ORD-2024-005(入住晚数与日期不符)');
  console.log('3. ❌ 金额冲突: APV-2024-004(负数金额), STMT-2024-001 ITEM-004(小计计算错误)');
  console.log('4. ❌ 跨日/找不到: STMT-2024-001 ITEM-006(房间999不存在)');
  console.log('5. ❌ 保洁类型冲突: CLN-2024-004(连住客人未要求换布草但安排了)');
  console.log('6. ❌ 保洁未完成: CLN-2024-004(in_progress状态)');
  console.log('7. ❌ 审批异常: APV-2024-004(负数退款)');

  console.log('\n=== 数据已准备就绪，请运行 test-requests.ts 发送API请求 ===');
  console.log('  npm run test-request  # 发送所有数据到API');
  
  await closeDatabase();
}

export {
  generateOrders,
  generateCleaningMessages,
  generateMaintenanceNotes,
  generateApprovalEmails,
  generateSupplierStatement
};

if (require.main === module) {
  main().catch(console.error);
}
