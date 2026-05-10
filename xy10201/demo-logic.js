console.log('========================================');
console.log('  牙科椅旁耗材补货台 - 业务逻辑演示');
console.log('========================================\n');

const STATUS_FLOW = {
  REPLENISHMENT: {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['FULFILLED'],
    REJECTED: [],
    FULFILLED: []
  }
};

const STATUS_LABELS = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  FULFILLED: '已补货'
};

function canTransition(current, next) {
  const allowed = STATUS_FLOW.REPLENISHMENT[current] || [];
  return allowed.includes(next);
}

let passed = 0, failed = 0;
function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ ${testName}`);
    failed++;
  }
}

console.log('【场景1】状态机验证');
console.log('--------------------');
assert(canTransition('PENDING', 'APPROVED') === true, '待审核可以通过');
assert(canTransition('PENDING', 'REJECTED') === true, '待审核可以拒绝');
assert(canTransition('APPROVED', 'FULFILLED') === true, '已通过可以完成补货');
assert(canTransition('REJECTED', 'APPROVED') === false, '已拒绝不能再通过');
assert(canTransition('FULFILLED', 'PENDING') === false, '已补货不能退回待审核');

console.log('\n【场景2】库存预警检测');
console.log('--------------------');
function getStockStatus(quantity, warningThreshold) {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity < warningThreshold) return 'LOW_STOCK';
  return 'NORMAL';
}

assert(getStockStatus(50, 20) === 'NORMAL', '库存50 预警20 → 正常');
assert(getStockStatus(15, 20) === 'LOW_STOCK', '库存15 预警20 → 库存不足');
assert(getStockStatus(0, 20) === 'OUT_OF_STOCK', '库存0 预警20 → 已断货');
assert(getStockStatus(20, 20) === 'NORMAL', '库存=预警 → 正常');

console.log('\n【场景3】诊疗项目耗材绑定 & 库存检测');
console.log('--------------------------------------');

const treatmentMaterials = [
  { treatment_id: 1, material_id: 1, quantity: 2, unit: '支' },
  { treatment_id: 1, material_id: 2, quantity: 1, unit: '个' },
  { treatment_id: 1, material_id: 3, quantity: 5, unit: 'ml' },
  { treatment_id: 1, material_id: 4, quantity: 1, unit: '支' },
  { treatment_id: 1, material_id: 5, quantity: 2, unit: '片' }
];

const materials = [
  { id: 1, name: '高速金刚砂车针', quantity: 30, warning_threshold: 20 },
  { id: 2, name: '一次性检查盘', quantity: 5, warning_threshold: 10 },
  { id: 3, name: '光固化复合树脂', quantity: 3, warning_threshold: 10 },
  { id: 4, name: '牙科粘接剂', quantity: 8, warning_threshold: 5 },
  { id: 5, name: '树脂抛光条', quantity: 2, warning_threshold: 10 }
];

function checkTreatmentStock(treatmentId, patientCount = 1) {
  const bindings = treatmentMaterials.filter(t => t.treatment_id === treatmentId);
  const issues = [];
  
  bindings.forEach(binding => {
    const material = materials.find(m => m.id === binding.material_id);
    const needed = binding.quantity * patientCount;
    if (!material || material.quantity < needed) {
      issues.push({
        material_name: material?.name,
        needed,
        available: material?.quantity || 0
      });
    }
  });
  
  return {
    canExecute: issues.length === 0,
    totalBindings: bindings.length,
    insufficientItems: issues,
    bindingList: bindings.map(b => {
      const m = materials.find(x => x.id === b.material_id);
      return {
        name: m.name,
        needed: b.quantity,
        available: m.quantity,
        status: getStockStatus(m.quantity, m.warning_threshold)
      };
    })
  };
}

const stockCheck = checkTreatmentStock(1, 1);
assert(stockCheck.totalBindings === 5, '补牙项目绑定5种耗材');
assert(stockCheck.canExecute === false, '因库存不足无法执行');
assert(stockCheck.insufficientItems.length === 1, '1种耗材当前库存不足以满足消耗(树脂:需5ml,现有3ml)');

const lowStockCount = stockCheck.bindingList.filter(i => i.status !== 'NORMAL').length;
assert(lowStockCount === 3, '3种耗材处于预警状态(检查盘、树脂、抛光条)');

console.log('\n   耗材绑定清单:');
stockCheck.bindingList.forEach(item => {
  const statusColor = item.status === 'NORMAL' ? '✓' : item.status === 'LOW_STOCK' ? '!' : '✗';
  console.log(`     ${statusColor} ${item.name}: 需要${item.needed}, 现有${item.available}`);
});

console.log('\n【场景4】耗材消耗（事务一致性）');
console.log('--------------------------------');

let inventory = JSON.parse(JSON.stringify(materials));
let snapshots = [];
let logs = [];

function consumeMaterial(materialId, quantity, operator, reason) {
  const material = inventory.find(m => m.id === materialId);
  if (!material) throw new Error('耗材不存在');
  if (material.quantity < quantity) {
    throw new Error(`库存不足：当前${material.quantity}${material.unit || ''}，需要${quantity}${material.unit || ''}`);
  }
  
  const before = material.quantity;
  material.quantity -= quantity;
  const after = material.quantity;
  
  snapshots.push({
    material_id: materialId,
    before_quantity: before,
    change_quantity: -quantity,
    after_quantity: after,
    operator,
    reason
  });
  
  logs.push({
    module: 'CONSUMPTION',
    action: '消耗',
    target_type: 'MATERIAL',
    target_id: materialId,
    before_data: JSON.stringify({ quantity: before }),
    after_data: JSON.stringify({ quantity: after }),
    operator
  });
  
  return { success: true, before, after };
}

try {
  consumeMaterial(1, 5, '护士小王', '常规补牙');
  assert(true, '消耗车针5支成功');
  assert(inventory[0].quantity === 25, '库存从30减至25');
  assert(snapshots.length === 1, '生成1条库存快照');
  assert(logs.length === 1, '生成1条操作日志');
} catch (e) {
  assert(false, '消耗车针5支失败: ' + e.message);
}

try {
  consumeMaterial(3, 10, '护士小王', '超额测试');
  assert(false, '超额消耗不应成功');
} catch (e) {
  assert(e.message.includes('库存不足'), '超额消耗抛出预期错误');
}

console.log('\n【场景5】补货申请审核流程');
console.log('--------------------------');

let requests = [];
let audits = [];

function createReplenishmentRequest(materialId, quantity, requester) {
  return {
    id: requests.length + 1,
    request_no: `RP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(requests.length + 1).padStart(4,'0')}`,
    material_id: materialId,
    requested_quantity: quantity,
    status: 'PENDING',
    requester,
    created_at: new Date().toISOString()
  };
}

function approveRequest(requestId, approvedQuantity, auditor) {
  const request = requests.find(r => r.id === requestId);
  if (!canTransition(request.status, 'APPROVED')) {
    throw new Error(`当前状态"${STATUS_LABELS[request.status]}"不允许通过`);
  }
  request.status = 'APPROVED';
  request.approved_quantity = approvedQuantity;
  audits.push({ request_id: requestId, action: 'APPROVED', auditor, approved_quantity: approvedQuantity });
  return request;
}

function rejectRequest(requestId, reason, auditor) {
  const request = requests.find(r => r.id === requestId);
  if (!canTransition(request.status, 'REJECTED')) {
    throw new Error(`当前状态"${STATUS_LABELS[request.status]}"不允许拒绝`);
  }
  request.status = 'REJECTED';
  request.reject_reason = reason;
  audits.push({ request_id: requestId, action: 'REJECTED', auditor, reason });
  return request;
}

function fulfillRequest(requestId, operator) {
  const request = requests.find(r => r.id === requestId);
  if (!canTransition(request.status, 'FULFILLED')) {
    throw new Error(`当前状态"${STATUS_LABELS[request.status]}"不允许完成补货`);
  }
  request.status = 'FULFILLED';
  request.fulfilled_at = new Date().toISOString();
  audits.push({ request_id: requestId, action: 'FULFILLED', operator });
  
  const material = inventory.find(m => m.id === request.material_id);
  if (material) {
    const before = material.quantity;
    material.quantity += request.approved_quantity;
    snapshots.push({
      material_id: request.material_id,
      before_quantity: before,
      change_quantity: request.approved_quantity,
      after_quantity: material.quantity,
      operator,
      reason: `补货入库 [${request.request_no}]`
    });
  }
  return request;
}

const req = createReplenishmentRequest(3, 30, '护士小王');
requests.push(req);
assert(req.status === 'PENDING', '新建申请状态为待审核');
assert(req.request_no.startsWith('RP-'), '申请单号格式正确');

const approved = approveRequest(1, 25, '护士长李姐');
assert(approved.status === 'APPROVED', '审核通过后状态变更');
assert(approved.approved_quantity === 25, '审核数量25(申请30)');

const fulfilled = fulfillRequest(1, '库管小张');
assert(fulfilled.status === 'FULFILLED', '补货完成状态');

const resin = inventory.find(m => m.id === 3);
assert(resin.quantity === 28, `树脂库存: 初始3 + 25(补货) = 28 (5支消耗尝试失败未扣减)`);

try {
  const req2 = createReplenishmentRequest(4, 10, '护士小王');
  requests.push(req2);
  rejectRequest(req2.id, '库存充足，暂不需要', '护士长李姐');
  approveRequest(req2.id, 10, '护士长李姐');
  assert(false, '已拒绝的申请不应能通过');
} catch (e) {
  assert(e.message.includes('不允许通过'), '已拒绝状态阻止后续操作');
}

console.log('\n【场景6】数据一致性验证');
console.log('------------------------');

const lastSnapshot = snapshots[snapshots.length - 1];
const lastRequest = requests[0];
assert(
  lastSnapshot.change_quantity === lastRequest.approved_quantity,
  `补货入库量(${lastSnapshot.change_quantity}) = 审核数量(${lastRequest.approved_quantity})`
);

const logCount = logs.filter(l => l.module === 'CONSUMPTION').length;
const snapshotCount = snapshots.filter(s => s.change_quantity < 0).length;
assert(logCount === snapshotCount, `消耗日志数(${logCount}) = 消耗快照数(${snapshotCount})`);

console.log('\n========================================');
console.log(`  验证结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================\n');

if (failed === 0) {
  console.log('✅ 所有业务逻辑验证通过！');
  console.log('');
  console.log('核心业务闭环：');
  console.log('  1. 诊疗项目 → 绑定耗材模板 → 执行消耗');
  console.log('  2. 库存不足 → 触发预警 → 生成卡点');
  console.log('  3. 补货申请 → 审核通过 → 确认入库');
  console.log('  4. 全程记录：消耗记录 + 库存快照 + 操作日志');
  console.log('');
  console.log('关键辨识度：');
  console.log('  ✓ 椅旁消耗：选择诊疗项目自动展开耗材清单');
  console.log('  ✓ 项目模板：标准用量绑定，避免手动漏录');
  console.log('  ✓ 可追溯：每次库存变动有快照，审核有记录');
} else {
  console.log('❌ 存在验证失败，请检查代码');
  process.exit(1);
}
