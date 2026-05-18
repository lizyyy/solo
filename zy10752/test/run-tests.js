const fs = require('fs');
const path = require('path');
const { checkPermissionDowngrade, PERMISSION_CATEGORIES } = require('../src/checker');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function loadFixture(filename) {
  const content = fs.readFileSync(path.join(__dirname, '..', 'examples', filename), 'utf-8');
  return JSON.parse(content);
}

console.log('========================================');
console.log('  应用权限清单权限降级核验 - 自动化测试');
console.log('========================================\n');

console.log('📋 测试套件 1: 正常路径 - 完全降级，无残留');
test('输出应包含明确的工具名称标识', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-clean.json');
  const result = checkPermissionDowngrade(base, target);
  assert(result.toolName === '应用权限清单权限降级核验', `期望工具名称为'应用权限清单权限降级核验'，实际为'${result.toolName}'`);
});

test('完全降级后应无残留权限', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-clean.json');
  const result = checkPermissionDowngrade(base, target);
  assert(result.summary.totalResidue === 0, `期望残留数量为0，实际为${result.summary.totalResidue}`);
});

test('检查结果应为"无残留权限"', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-clean.json');
  const result = checkPermissionDowngrade(base, target);
  assert(result.summary.checkResult === '无残留权限', `期望检查结果为'无残留权限'，实际为'${result.summary.checkResult}'`);
});

test('权限数量统计应正确', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-clean.json');
  const result = checkPermissionDowngrade(base, target);
  assert(result.metadata.baseCount === 5, `基准数量期望为5，实际为${result.metadata.baseCount}`);
  assert(result.metadata.targetCount === 5, `目标数量期望为5，实际为${result.metadata.targetCount}`);
});

console.log('\n📋 测试套件 2: 异常路径 - 存在残留权限');
test('应检测到旧token残留权限', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-with-residue.json');
  const result = checkPermissionDowngrade(base, target);
  const count = result.summary.categories[PERMISSION_CATEGORIES.OLD_TOKEN] || 0;
  assert(count >= 1, `期望检测到至少1个旧token残留，实际为${count}`);
});

test('应检测到子应用残留权限', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-with-residue.json');
  const result = checkPermissionDowngrade(base, target);
  const count = result.summary.categories[PERMISSION_CATEGORIES.SUB_APP] || 0;
  assert(count >= 1, `期望检测到至少1个子应用残留，实际为${count}`);
});

test('应检测到缓存残留权限', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-with-residue.json');
  const result = checkPermissionDowngrade(base, target);
  const count = result.summary.categories[PERMISSION_CATEGORIES.CACHE] || 0;
  assert(count >= 1, `期望检测到至少1个缓存残留，实际为${count}`);
});

test('残留权限总数应正确', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-with-residue.json');
  const result = checkPermissionDowngrade(base, target);
  assert(result.summary.totalResidue >= 3, `期望至少3个残留，实际为${result.summary.totalResidue}`);
});

test('残留详情应包含具体权限信息', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-with-residue.json');
  const result = checkPermissionDowngrade(base, target);
  assert(result.residue.length > 0, '残留列表不应为空');
  const item = result.residue[0];
  assert(item.permissionId, '应包含权限ID');
  assert(item.permissionName, '应包含权限名称');
  assert(item.category, '应包含类别');
  assert(item.description, '应包含问题描述');
  assert(item.diff.length > 0, '应包含差异详情');
});

console.log('\n📋 测试套件 3: 边界条件');
test('空权限列表应正常处理', () => {
  const result = checkPermissionDowngrade([], []);
  assert(result.summary.totalResidue === 0, '空列表应无残留');
  assert(result.summary.checkResult === '无残留权限', '空列表应显示无残留');
});

test('基准为空时正常处理', () => {
  const target = loadFixture('target-permissions.json');
  const result = checkPermissionDowngrade([], target);
  assert(result.metadata.baseCount === 0, '基准数量应为0');
});

test('权限级别提升时应检测为残留', () => {
  const base = [{ id: 'p1', name: '测试', type: 'token', scope: 'old_token', level: 'read' }];
  const target = [{ id: 'p1', name: '测试', type: 'token', scope: 'old_token', enabled: false, level: 'admin' }];
  const result = checkPermissionDowngrade(base, target);
  assert(result.summary.totalResidue >= 1, '权限级别提升应检测为残留');
});

console.log('\n📋 测试套件 4: 部分残留场景');
test('部分残留应正确分类统计', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions.json');
  const result = checkPermissionDowngrade(base, target);
  const categories = Object.keys(result.summary.categories);
  assert(categories.length > 0, '应至少有一个类别有残留');
});

test('残留权限应按类别分组', () => {
  const base = loadFixture('base-permissions.json');
  const target = loadFixture('target-permissions-with-residue.json');
  const result = checkPermissionDowngrade(base, target);
  for (const category of Object.values(PERMISSION_CATEGORIES)) {
    const details = result.details[category];
    assert(Array.isArray(details), `类别${category}的详情应为数组`);
  }
});

console.log('\n========================================');
console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
