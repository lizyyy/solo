import { applicationService } from '../services/applicationService';
import {
  validApplication,
  lateApplication,
  urgentApplication,
  inconsistentApplication,
  duplicateApplication,
  sampleMeals
} from '../data/sampleData';

console.log('═══════════════════════════════════════════════════════════════');
console.log('           月子餐配送组月子餐忌口替换API - 种子数据加载');
console.log('═══════════════════════════════════════════════════════════════\n');

applicationService.clearAll();

console.log('📋 参考菜品库:');
sampleMeals.forEach(meal => {
  console.log(`  ${meal.id}: ${meal.name} (${meal.category})`);
});
console.log('');

console.log('───────────────────────────────────────────────────────────────');
console.log('✅ 【场景1】正常申请 - 时间充足、数据一致');
const result1 = applicationService.createApplication(validApplication);
console.log(`   产妇: ${result1.motherName} (${result1.roomNumber})`);
console.log(`   状态: ${result1.status}`);
console.log(`   忌口: ${result1.dietaryRestrictions.map(r => r.name).join('、')}`);
console.log(`   替换菜品数: ${result1.replacementItems.length}`);
console.log('');

console.log('───────────────────────────────────────────────────────────────');
console.log('❌ 【场景2】超时申请 - 已过备餐截止时间，自动驳回');
const result2 = applicationService.createApplication(lateApplication);
console.log(`   产妇: ${result2.motherName} (${result2.roomNumber})`);
console.log(`   状态: ${result2.status}`);
console.log(`   拦截原因: ${result2.rejectionReason}`);
console.log(`   错误消息: ${result2.rejectionMessage}`);
console.log('');

console.log('───────────────────────────────────────────────────────────────');
console.log('⚠️  【场景3】紧急申请 - 距备餐不足1小时，进入人工处理');
const result3 = applicationService.createApplication(urgentApplication);
console.log(`   产妇: ${result3.motherName} (${result3.roomNumber})`);
console.log(`   状态: ${result3.status}`);
console.log(`   处理建议: ${result3.rejectionMessage}`);
console.log('');

console.log('───────────────────────────────────────────────────────────────');
console.log('❌ 【场景4】不一致申请 - 替换理由与忌口不匹配，自动驳回');
const result4 = applicationService.createApplication(inconsistentApplication);
console.log(`   产妇: ${result4.motherName} (${result4.roomNumber})`);
console.log(`   状态: ${result4.status}`);
console.log(`   拦截原因: ${result4.rejectionReason}`);
console.log(`   错误消息: ${result4.rejectionMessage}`);
console.log('');

console.log('───────────────────────────────────────────────────────────────');
console.log('❌ 【场景5】重复申请 - 同一菜品多次申请，自动驳回');
const result5 = applicationService.createApplication(duplicateApplication);
console.log(`   产妇: ${result5.motherName} (${result5.roomNumber})`);
console.log(`   状态: ${result5.status}`);
console.log(`   拦截原因: ${result5.rejectionReason}`);
console.log(`   错误消息: ${result5.rejectionMessage}`);
console.log('');

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 数据汇总:');
const all = applicationService.getAllApplications();
console.log(`   总申请数: ${all.length}`);
console.log(`   PENDING (待审核): ${all.filter(a => a.status === 'pending').length}`);
console.log(`   PROCESSING (人工处理): ${all.filter(a => a.status === 'processing').length}`);
console.log(`   REJECTED (已驳回): ${all.filter(a => a.status === 'rejected').length}`);
console.log('');
console.log('💡 提示: 运行 npm run dev 启动服务后，可通过 /api/applications 查看所有申请');
console.log('═══════════════════════════════════════════════════════════════');
