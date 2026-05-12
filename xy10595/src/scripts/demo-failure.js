console.log('\n' + '='.repeat(70));
console.log('检修备件最低库存 API - 失败路径演示');
console.log('='.repeat(70));

const initSchema = require('../config/schema');
initSchema();

const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const receptionService = require('../services/receptionService');

const step = (title, fn) => {
  console.log('\n' + '-'.repeat(70));
  console.log(`【${title}】`);
  console.log('-'.repeat(70));
  fn();
};

require('./seed');

const parts = SparePart.findAll().reduce((acc, p) => { acc[p.code] = p; return acc; }, {});
const equipments = Equipment.findAll().reduce((acc, e) => { acc[e.code] = e; return acc; }, {});

step('失败场景1: 状态流转异常 - 非待审批状态直接处理', () => {
  const part = parts['SEAL-001'];
  
  const createResult = receptionService.createReception({
    partId: part.id,
    requestedQuantity: 1,
    requester: '测试'
  });
  const receptionId = createResult.reception.id;
  
  console.log(`当前状态: ${createResult.reception.status} (PENDING - 待审批)`);
  console.log('尝试直接跳过审批执行出库处理...');
  
  const processResult = receptionService.processReception(receptionId, '仓库管理员');
  
  console.log(`\n结果: ${processResult.success ? '成功' : '失败'}`);
  console.log(`原因: ${processResult.message}`);
  
  console.log('\n状态历史:');
  const history = receptionService.getReceptionDetail(receptionId);
  history.history.forEach((h, i) => {
    console.log(`  ${i + 1}. ${h.from_status || '-'} → ${h.to_status} | ${h.reason}`);
  });
});

step('失败场景2: 库存不足且无替代件', () => {
  const part = parts['HYD-001'];
  const equipment = equipments['EQ-003'];
  
  console.log(`备件: ${part.code} ${part.name}`);
  console.log(`当前库存: ${part.current_stock}`);
  console.log(`领用数量: 5`);
  console.log(`用于: ${equipment.code} ${equipment.name} (关键设备)`);
  
  const createResult = receptionService.createReception({
    partId: part.id,
    equipmentId: equipment.id,
    requestedQuantity: 5,
    requester: '维修班'
  });
  const receptionId = createResult.reception.id;
  
  receptionService.approveReception(receptionId, '李班长');
  const processResult = receptionService.processReception(receptionId, '仓库管理员');
  
  console.log(`\n处理结果:`);
  console.log(`  成功: ${processResult.success}`);
  console.log(`  有替代件: ${processResult.hasAlternative}`);
  console.log(`  消息: ${processResult.message}`);
  
  console.log(`\n状态历史:`);
  const history = receptionService.getReceptionDetail(receptionId);
  history.history.forEach((h, i) => {
    console.log(`  ${i + 1}. ${h.from_status || '-'} → ${h.to_status}`);
    console.log(`     原因: ${h.reason}`);
  });
});

step('失败场景3: 替代件兼容性限制 - 关键设备不允许使用替代', () => {
  const originalPart = parts['BEAR-001'];
  const equipment = equipments['EQ-001'];
  
  console.log(`备件: ${originalPart.code} ${originalPart.name}`);
  console.log(`当前库存: ${originalPart.current_stock}, 需要: 3`);
  console.log(`用于: ${equipment.code} ${equipment.name} (关键设备)`);
  console.log(`\n替代件限制: BEAR-002 仅可用于 EQ-002, EQ-004`);
  console.log(`当前设备 EQ-001 不在允许列表内`);
  
  const createResult = receptionService.createReception({
    partId: originalPart.id,
    equipmentId: equipment.id,
    requestedQuantity: 3,
    requester: '维修班'
  });
  const receptionId = createResult.reception.id;
  
  receptionService.approveReception(receptionId, '李班长');
  const processResult = receptionService.processReception(receptionId, '仓库管理员');
  
  console.log(`\n处理结果:`);
  console.log(`  成功: ${processResult.success}`);
  console.log(`  有可用替代件: ${processResult.hasAlternative ? '是' : '否'}`);
  console.log(`  原因: ${processResult.message}`);
});

step('失败场景4: 参数验证失败 - 必需字段缺失', () => {
  console.log('尝试创建领用单，不提供必需字段...');
  
  try {
    receptionService.createReception({
      requestedQuantity: 1
    });
  } catch (e) {
    console.log(`错误: ${e.message}`);
  }
  
  try {
    receptionService.createReception({
      partId: 'non-existent-id',
      requestedQuantity: 1
    });
  } catch (e) {
    console.log(`错误: ${e.message}`);
  }
});

step('失败场景5: 重复状态操作 - 已完成的单子无法再次操作', () => {
  const part = parts['SEAL-001'];
  
  const createResult = receptionService.createReception({
    partId: part.id,
    requestedQuantity: 1,
    requester: '测试'
  });
  const receptionId = createResult.reception.id;
  
  receptionService.approveReception(receptionId, '李班长');
  receptionService.processReception(receptionId, '仓库管理员');
  const completeResult = receptionService.completeReception(receptionId, '仓库管理员');
  
  console.log(`领用单当前状态: ${completeResult.reception.status}`);
  console.log('尝试对已完成的领用单再次执行审批...');
  
  const retryApprove = receptionService.approveReception(receptionId, '李班长');
  console.log(`\n结果: ${retryApprove.success ? '成功' : '失败'}`);
  console.log(`原因: ${retryApprove.message}`);
});

console.log('\n' + '='.repeat(70));
console.log('失败场景演示完成');
console.log('='.repeat(70));
console.log('\n关键失败点总结:');
console.log('  1. 状态机严格校验：只有正确状态才能执行对应操作');
console.log('  2. 库存校验：库存不足且无可用替代件时领用失败');
console.log('  3. 替代件限制：关键设备可能不允许使用某些替代件');
console.log('  4. 参数校验：必需字段缺失或数据不存在时快速失败');
console.log('  5. 幂等保护：重复操作不会产生副作用');
console.log('');
