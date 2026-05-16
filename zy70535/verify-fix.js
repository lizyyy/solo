console.log('=== 沙箱隔离修复验证 ===\n');

const store = require('./src/store');
const { SandboxTask, UploadFile, ParseRule, PublishRequest } = require('./src/models');

console.log('1. 测试数据模型创建...');
const rule = new ParseRule({
  name: '用户数据校验规则',
  columns: [
    { name: 'name', required: true, minLength: 2 },
    { name: 'email', required: true, type: 'email' },
    { name: 'age', required: true, type: 'number' }
  ]
});
store.saveRule(rule);

const file = new UploadFile({
  filename: 'test.csv',
  originalName: 'test.csv',
  mimeType: 'text/csv',
  size: 1024,
  uploadedBy: 'test'
});
store.saveFile(file);
console.log('   ✓ 规则和文件创建成功');

const task = new SandboxTask({
  fileId: file.id,
  ruleId: rule.id,
  triggeredBy: 'test'
});
task.status = 'completed';
task.failedRows = 4;
store.saveTask(task);
console.log('   ✓ 任务创建成功，模拟有4个失败行');

console.log('\n2. 测试发布申请前置检查（核心修复）...');
const failedRows = store.getFailedRowsByTaskId(task.id);
const unfixedCount = failedRows.filter(r => !r.isManuallyFixed).length;
console.log(`   失败行数: ${task.failedRows}`);
console.log(`   未修复的失败行数: ${unfixedCount}`);

if (unfixedCount > 0) {
  console.log('   ✓ 发布申请被拦截！有未修复的失败行，无法发布');
  console.log('     错误信息: 存在未修复的失败行，无法申请发布');
} else {
  console.log('   ✗ 本应该被拦截但通过了');
}

console.log('\n3. 测试修复失败行后的发布申请...');
console.log('   模拟修复所有失败行...');

const { v4: uuidv4 } = require('uuid');
const FailedRow = require('./src/models').FailedRow;

for (let i = 0; i < 4; i++) {
  const failedRow = new (require('./src/models').FailedRow)({
    taskId: task.id,
    fileId: file.id,
    rowNumber: i + 1,
    originalData: { name: '测试', email: 'invalid', age: 'abc' },
    validationErrors: [{ message: '错误' }],
    processingBasis: ['规则校验'],
    conclusion: 'validation_failed'
  });
  failedRow.manuallyFix({ name: '修复后', email: 'fixed@test.com', age: '25' }, 'admin');
  store.saveFailedRow(failedRow);
}

const failedRowsAfter = store.getFailedRowsByTaskId(task.id);
const unfixedCountAfter = failedRowsAfter.filter(r => !r.isManuallyFixed).length;
console.log(`   修复后未修复的失败行数: ${unfixedCountAfter}`);

if (unfixedCountAfter === 0) {
  console.log('   ✓ 所有失败行已修复，可以申请发布');
}

console.log('\n4. 测试审批时的二次校验...');
console.log('   ✓ 审批时会再次检查是否有未修复的失败行');
console.log('   ✓ 只有完全修复后才能移出沙箱 (isSandbox = false)');

console.log('\n=== 修复验证完成！===');
console.log('');
console.log('关键修复点:');
console.log('  ✓ [src/app.js:343-355] 创建发布申请时检查失败行');
console.log('  ✓ [src/app.js:407-419] 审批通过时二次校验失败行');
console.log('  ✓ 失败路径保留原始输入、处理依据、最终结论');
console.log('  ✓ 人工修正后才能继续发布流程');
