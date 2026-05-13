const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('  验证 dental-app.html 历史追溯修复');
console.log('========================================\n');

const htmlPath = path.join(__dirname, 'dental-app.html');
const content = fs.readFileSync(htmlPath, 'utf-8');

let passed = 0, failed = 0;

function check(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ ${testName}`);
    failed++;
  }
}

console.log('【1】检查 renderHistory 函数');
console.log('--------------------');

const renderHistoryMatch = content.match(/renderHistory\(el\)\s*\{[\s\S]*?\n\s*\}/);
if (renderHistoryMatch) {
  const func = renderHistoryMatch[0];
  check(
    func.includes('if (!this.state.history) this.state.history = { tab: '),
    'renderHistory 正确初始化 state.history 对象'
  );
  check(
    !func.includes('if (!this.state.history) this.state.history.tab = '),
    'renderHistory 不再错误地尝试写入 undefined'
  );
} else {
  check(false, '找到 renderHistory 函数');
}

console.log('\n【2】检查 setHistoryTab 函数');
console.log('--------------------');

const setHistoryTabMatch = content.match(/setHistoryTab\(tab\)\s*\{[\s\S]*?\n\s*\}/);
if (setHistoryTabMatch) {
  const func = setHistoryTabMatch[0];
  check(
    func.includes('if (!this.state.history)'),
    'setHistoryTab 包含 state.history 保护检查'
  );
} else {
  check(false, '找到 setHistoryTab 函数');
}

console.log('\n【3】检查 resetData 函数');
console.log('--------------------');

const resetDataMatch = content.match(/resetData\(\)\s*\{[\s\S]*?\n\s*\}/);
if (resetDataMatch) {
  const func = resetDataMatch[0];
  check(
    func.includes('history: { tab: \'consumption\' }'),
    'resetData 重置 state 时包含 history 初始化'
  );
  check(
    func.includes('treatments: {}'),
    'resetData 重置 state 时包含 treatments 初始化'
  );
  check(
    func.includes('consumption: {}'),
    'resetData 重置 state 时包含 consumption 初始化'
  );
  check(
    func.includes('replenishment: {}'),
    'resetData 重置 state 时包含 replenishment 初始化'
  );
  check(
    func.includes('materials: {}'),
    'resetData 重置 state 时包含 materials 初始化'
  );
  check(
    !func.includes('this.state = {};'),
    'resetData 不再直接清空 state 为 {}'
  );
} else {
  check(false, '找到 resetData 函数');
}

console.log('\n【4】其他页面 state 初始化检查');
console.log('--------------------');

check(content.includes('if (!this.state.treatments) this.state.treatments = {}'), 'renderTreatments 有 state 保护');
check(content.includes('if (!this.state.consumption)'), 'renderConsumption 有 state 保护');
check(content.includes('if (!this.state.replenishment)'), 'renderReplenishment 有 state 保护');
check(content.includes('if (!this.state.materials) this.state.materials = {'), 'renderMaterials 有 state 保护');

console.log('\n========================================');
console.log(`  验证结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================\n');

if (failed === 0) {
  console.log('✅ 所有代码检查通过！');
  console.log('');
  console.log('历史追溯页面访问流程：');
  console.log('  1. 点击左侧菜单「历史追溯」');
  console.log('  2. renderHistory 检查 this.state.history');
  console.log('  3. 首次访问时 this.state.history = { tab: \'consumption\' }');
  console.log('  4. 页面正常渲染，3 个标签页可用：消耗记录 / 补货申请 / 操作日志');
  console.log('  5. 点击标签页时 setHistoryTab 也有保护，不会报错');
  console.log('');
  process.exit(0);
} else {
  console.log('❌ 存在检查失败项');
  process.exit(1);
}
