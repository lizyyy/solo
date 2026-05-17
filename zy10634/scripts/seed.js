const store = require('../src/store');
const { STATUS_FLOW, REASSIGNMENT_TYPES } = require('../src/models/Compensation');

console.log('开始生成测试数据...\n');

store.clear();

const riders = [
  { id: 'R001', name: '张三' },
  { id: 'R002', name: '李四' },
  { id: 'R003', name: '王五' },
  { id: 'R004', name: '赵六' },
  { id: 'R005', name: '钱七' }
];

const reasons = [
  '骑手联系不上客户',
  '配送地址偏远',
  '订单超重',
  '天气恶劣',
  '车辆故障',
  '订单取消改派',
  '商家出餐延迟'
];

let orderCounter = 1000;

function generateOrderNo() {
  return `ORD${++orderCounter}`;
}

function createCompensation(rider, type, reason, amount, status = STATUS_FLOW.PENDING_DISPATCH) {
  const orderId = `O${orderCounter}`;
  return store.create({
    riderId: rider.id,
    riderName: rider.name,
    orderId,
    orderNo: generateOrderNo(),
    reassignmentType: type,
    reason,
    compensationAmount: amount,
    status,
    operator: 'seed-script'
  });
}

console.log('1. 创建完整流转记录（骑手拒单，待派送 -> 改派中 -> 补偿待审 -> 已结算）');
const fullFlowRider = riders[0];
const fullFlowComp = createCompensation(
  fullFlowRider,
  REASSIGNMENT_TYPES.RIDER_REJECT,
  reasons[0],
  15.5,
  STATUS_FLOW.PENDING_DISPATCH
);
const fullFlowId = fullFlowComp.id;

fullFlowComp.transitionTo(STATUS_FLOW.REASSIGNING, '骑手确认拒单，启动改派流程', 'admin');
fullFlowComp.transitionTo(STATUS_FLOW.COMPENSATION_PENDING, '改派完成，提交补偿审核', 'system');
fullFlowComp.transitionTo(STATUS_FLOW.SETTLED, '补偿审核通过，已打款', 'finance');
console.log(`   记录ID: ${fullFlowId}`);
console.log(`   当前状态: ${fullFlowComp.status}`);
console.log(`   历史记录数: ${fullFlowComp.history.length}\n`);

console.log('2. 创建系统改派完整流转记录');
const systemFlowRider = riders[1];
const systemFlowComp = createCompensation(
  systemFlowRider,
  REASSIGNMENT_TYPES.SYSTEM_REASSIGN,
  reasons[6],
  20.0,
  STATUS_FLOW.PENDING_DISPATCH
);
systemFlowComp.transitionTo(STATUS_FLOW.REASSIGNING, '系统检测到超时，自动改派', 'system');
systemFlowComp.transitionTo(STATUS_FLOW.COMPENSATION_PENDING, '改派完成，自动生成补偿', 'system');
console.log(`   记录ID: ${systemFlowComp.id}`);
console.log(`   当前状态: ${systemFlowComp.status}\n`);

console.log('3. 创建冲突记录（同一订单重复提交）');
const conflictRider = riders[2];
const conflictOrderId = 'O-CONFLICT-001';
const conflict1 = store.create({
  riderId: conflictRider.id,
  riderName: conflictRider.name,
  orderId: conflictOrderId,
  orderNo: 'ORD-CONFLICT-001',
  reassignmentType: REASSIGNMENT_TYPES.RIDER_REJECT,
  reason: reasons[1],
  compensationAmount: 18.0,
  status: STATUS_FLOW.REASSIGNING,
  operator: 'operator-a'
});

const conflict2 = store.create({
  riderId: riders[3].id,
  riderName: riders[3].name,
  orderId: conflictOrderId,
  orderNo: 'ORD-CONFLICT-001',
  reassignmentType: REASSIGNMENT_TYPES.SYSTEM_REASSIGN,
  reason: reasons[2],
  compensationAmount: 25.0,
  status: STATUS_FLOW.PENDING_DISPATCH,
  operator: 'operator-b'
});
console.log(`   冲突记录1 ID: ${conflict1.id} (冲突: ${conflict1.conflict})`);
console.log(`   冲突记录2 ID: ${conflict2.id} (冲突: ${conflict2.conflict})\n`);

console.log('4. 创建导入坏行记录（数据不完整）');
const badRowComp = store.create({
  riderId: 'INVALID-RIDER',
  riderName: '未知骑手',
  orderId: 'ERR-ORDER-001',
  orderNo: 'ERR-001',
  reassignmentType: '未知类型',
  reason: '批量导入数据',
  compensationAmount: 0,
  status: STATUS_FLOW.PENDING_DISPATCH,
  operator: 'import-batch'
});
badRowComp.markAsImportError('骑手ID不存在，补偿金额为0');
console.log(`   坏行记录ID: ${badRowComp.id}`);
console.log(`   错误信息: ${badRowComp.importErrorMsg}\n`);

console.log('5. 创建各状态单条记录用于列表展示');
const statusRecords = [];
Object.values(STATUS_FLOW).forEach((status, idx) => {
  const rider = riders[idx % riders.length];
  const comp = createCompensation(
    rider,
    idx % 2 === 0 ? REASSIGNMENT_TYPES.RIDER_REJECT : REASSIGNMENT_TYPES.SYSTEM_REASSIGN,
    reasons[idx % reasons.length],
    10 + Math.random() * 20,
    status
  );
  statusRecords.push(comp);
});
console.log(`   创建了 ${statusRecords.length} 条各状态记录\n`);

console.log('=========================================');
console.log(`造数完成！总计生成 ${store.count()} 条补偿记录`);
console.log('=========================================');
console.log('\n关键记录ID:');
console.log(`  完整流转: ${fullFlowId}`);
console.log(`  冲突记录1: ${conflict1.id}`);
console.log(`  冲突记录2: ${conflict2.id}`);
console.log(`  导入坏行: ${badRowComp.id}`);
console.log('\n可使用以下命令查看:');
console.log(`  curl http://localhost:3000/api/compensations/${fullFlowId}`);
console.log(`  curl http://localhost:3000/api/compensations/${fullFlowId}/history`);
