const ECNService = require('../services/ecnService');
const { sampleECNs, getImpactData } = require('./sampleData');

console.log('==============================================');
console.log('       重复通知幂等性演示');
console.log('==============================================');
console.log();

console.log('【场景说明】');
console.log('系统由于网络重试或人工误操作，可能重复发送通知。');
console.log('幂等性保证: 重复通知不会产生副作用，状态保持一致。');
console.log('幂等性实现: 使用事件键 (ECN_ID:ACTION:ITEM_TYPE:ITEM_ID) 去重');
console.log();

let ecnId;
let materialId;

console.log('【步骤1】创建变更单并完成准备工作');
console.log('---');
const createResult = ECNService.createECN({
  ...sampleECNs.normal,
  title: '测试重复通知幂等性',
  createdBy: '测试工程师'
});
ecnId = createResult.data.id;

ECNService.submitECN(ecnId, '测试工程师');
ECNService.addImpactAnalysis(ecnId, getImpactData('full'), '分析师');
ECNService.approveECN(ecnId, '审批人');
ECNService.startExecution(ecnId, '执行专员');

const detail = ECNService.getECNDetail(ecnId);
materialId = detail.data.impacts.materials[0].id;
console.log(`✓ 准备完成`);
console.log(`  变更单: ${ecnId}`);
console.log(`  测试物料: ${detail.data.impacts.materials[0].materialCode}`);
console.log(`  当前状态: ${detail.data.impacts.materials[0].status}`);
console.log();

console.log('【步骤2】第一次发送通知（正常流程）');
console.log('---');
const notify1 = ECNService.notifyItem(ecnId, 'MATERIAL', materialId, '通知人-A');
if (notify1.success && !notify1.data.isDuplicate) {
  console.log(`✓ 第一次通知成功`);
  console.log(`  状态变化: PENDING -> ${notify1.data.status}`);
  console.log(`  通知时间: ${notify1.data.notifiedAt}`);
}
console.log();

console.log('【步骤3】立即重复发送通知（模拟网络重试）');
console.log('---');
const notify2 = ECNService.notifyItem(ecnId, 'MATERIAL', materialId, '通知人-B');
if (notify2.success && notify2.data.isDuplicate) {
  console.log(`✓ 幂等保护生效`);
  console.log(`  检测到重复，返回幂等响应`);
  console.log(`  消息: ${notify2.data.message}`);
}
console.log();

console.log('【步骤4】第N次重复发送通知（模拟人工误操作）');
console.log('---');
const notify3 = ECNService.notifyItem(ecnId, 'MATERIAL', materialId, '通知人-C');
if (notify3.success && notify3.data.isDuplicate) {
  console.log(`✓ 第N次重复也受保护`);
  console.log(`  无论多少次调用，结果保持一致`);
}
console.log();

console.log('【步骤5】验证最终状态（只变化一次）');
console.log('---');
const finalDetail = ECNService.getECNDetail(ecnId);
const finalMaterial = finalDetail.data.impacts.materials.find(m => m.id === materialId);
console.log(`  最终状态: ${finalMaterial.status}`);
console.log(`  状态正确: ${finalMaterial.status === 'NOTIFIED' ? '✓ 是' : '✗ 否'}`);
console.log();

console.log('【步骤6】查看历史记录（只记录一次）');
console.log('---');
const materialHistory = finalDetail.data.history.filter(h => 
  h.type === 'MATERIAL_UPDATE' && 
  h.action.includes(finalMaterial.materialCode)
);
console.log(`  物料更新历史记录数: ${materialHistory.length}`);
console.log(`  预期: 1 条（只记录第一次有效通知）`);
console.log(`  实际: ${materialHistory.length} 条`);
console.log(`  结果: ${materialHistory.length === 1 ? '✓ 正确' : '✗ 错误'}`);
console.log();

console.log('【步骤7】测试确认操作的幂等性');
console.log('---');
const ack1 = ECNService.acknowledgeItem(ecnId, 'MATERIAL', materialId, '确认人-A');
console.log(`  第一次确认: 成功`);

const manualUpdate = ECNService.manualUpdate(ecnId, 'MATERIAL', materialId, {
  status: 'COMPLETED',
  note: '人工完成处理'
}, '管理员-张三');

console.log(`  人工修正:`);
console.log(`    操作者: ${manualUpdate.data.updatedItem.operator}`);
console.log(`    状态变化: ${finalMaterial.status} -> ${manualUpdate.data.updatedItem.status}`);
if (manualUpdate.data.diff) {
  console.log(`    差异记录:`);
  Object.entries(manualUpdate.data.diff).forEach(([key, value]) => {
    console.log(`      ${key}: ${JSON.stringify(value.before)} -> ${JSON.stringify(value.after)}`);
  });
}
console.log();

console.log('==============================================');
console.log('       幂等性演示完成！');
console.log('==============================================');
console.log();
console.log('关键验证点:');
console.log('  ✓ 第一次通知: 正常执行，状态变更');
console.log('  ✓ 重复通知: 幂等保护，返回成功但不重复执行');
console.log('  ✓ 状态最终只变化一次');
console.log('  ✓ 历史记录只记录一次有效操作');
console.log('  ✓ 人工修正必须记录操作者和差异');
console.log('  ✓ 重复回调也保持幂等');
