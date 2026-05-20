const { generateBatchHash, TASK_STATUS } = require('./src/utils');

console.log('=== 汽车试驾车钥匙借还API服务 - 测试示例 ===\n');

console.log('任务状态枚举:');
console.log(JSON.stringify(TASK_STATUS, null, 2));

const testMaterials = [
  {
    key_number: 'KEY-001',
    key_status: 'borrowed',
    fuel_card_number: 'FC-2024-001',
    fuel_card_balance: 500,
    violation_records: '无违章记录',
    manual_registration: '张三 2024-01-15 借出'
  },
  {
    key_number: 'KEY-002',
    key_status: 'returned',
    fuel_card_number: 'FC-2024-002',
    fuel_card_balance: 300,
    violation_records: '2024-01-10 闯红灯 扣6分',
    manual_registration: '李四 2024-01-05 借出，2024-01-12 归还'
  }
];

console.log('\n测试材料数据:');
console.log(JSON.stringify(testMaterials, null, 2));

const hash = generateBatchHash(testMaterials);
console.log('\n批次哈希值:', hash);

console.log('\n=== API 使用示例 ===');
console.log('\n1. 提交材料:');
console.log('POST /api/tasks/submit');
console.log('Body:', JSON.stringify({
  submitter: '销售主管-王经理',
  materials: testMaterials
}, null, 2));

console.log('\n2. 更新任务状态:');
console.log('PATCH /api/tasks/:taskId/status');
console.log('Body:', JSON.stringify({
  newStatus: 'manual_confirm',
  operator: '审核员-李主管',
  changeReason: '材料核对无误，需要人工确认'
}, null, 2));

console.log('\n3. 获取任务详情:');
console.log('GET /api/tasks/:taskId');

console.log('\n4. 获取任务列表:');
console.log('GET /api/tasks');
console.log('GET /api/tasks?status=processing');

console.log('\n5. 获取统计信息:');
console.log('GET /api/tasks/statistics');

console.log('\n6. 获取审计日志:');
console.log('GET /api/tasks/:taskId/audit-logs');

console.log('\n7. 导出任务:');
console.log('POST /api/tasks/:taskId/export');
console.log('Body:', JSON.stringify({
  exportedBy: '导出员-张姐',
  format: 'csv'
}, null, 2));

console.log('\n8. 获取导出历史:');
console.log('GET /api/tasks/:taskId/export-history');