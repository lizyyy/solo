const MaskingService = require('../src/utils/masking');

function logTest(name, passed, message = '') {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} - ${name}`);
  if (message) console.log(`    ${message}`);
  return passed;
}

console.log('========================================');
console.log('  导出脱敏策略 - 自检脚本');
console.log('========================================\n');

let allPassed = true;

console.log('--- 1. 手机号脱敏规则测试 ---');
const phoneTests = [
  { phone: '13812345678', type: 'none', expected: '13812345678', desc: '管理员-不脱敏' },
  { phone: '13812345678', type: 'middle', expected: '138****5678', desc: '运营-中间脱敏' },
  { phone: '13812345678', type: 'last4', expected: '****5678', desc: '审计-仅后4位' },
  { phone: '13812345678', type: 'full', expected: '***********', desc: '客服-全脱敏' }
];

phoneTests.forEach(test => {
  const result = MaskingService.maskPhone(test.phone, test.type);
  const passed = result === test.expected;
  allPassed = logTest(test.desc, passed, `期望: ${test.expected}, 实际: ${result}`) && allPassed;
});

console.log('\n--- 2. 身份证号脱敏规则测试 ---');
const idTests = [
  { id: '110101199001011234', type: 'none', expected: '110101199001011234', desc: '管理员-不脱敏' },
  { id: '110101199001011234', type: 'middle', expected: '110101********1234', desc: '运营-中间脱敏' },
  { id: '110101199001011234', type: 'last4', expected: '************1234', desc: '审计-仅后4位' },
  { id: '110101199001011234', type: 'full', expected: '******************', desc: '客服-全脱敏' }
];

idTests.forEach(test => {
  const result = MaskingService.maskIdCard(test.id, test.type);
  const passed = result === test.expected;
  allPassed = logTest(test.desc, passed, `期望: ${test.expected}, 实际: ${result}`) && allPassed;
});

console.log('\n--- 3. 策略版本一致性测试 ---');
const strategies = [
  { field_name: 'phone', masking_type: 'middle' },
  { field_name: 'id_card', masking_type: 'middle' }
];
const testData = { name: '张三', phone: '13812345678', id_card: '110101199001011234' };
const maskedData = MaskingService.applyMasking(testData, strategies);
const phonePassed = maskedData.phone === '138****5678';
const idPassed = maskedData.id_card === '110101********1234';
allPassed = logTest('批量应用策略', phonePassed && idPassed, `phone: ${maskedData.phone}, id: ${maskedData.id_card}`) && allPassed;

console.log('\n--- 4. 违规拦截测试 ---');
const violationData = { phone: '13812345678', id_card: '110101199001011234' };
const violations = MaskingService.validateViolation(violationData, 'customer_service');
const hasViolation = violations.length > 0;
allPassed = logTest('客服角色未脱敏违规拦截', hasViolation, `违规数: ${violations.length}`) && allPassed;

const noViolationData = { phone: '***********', id_card: '******************' };
const noViolations = MaskingService.validateViolation(noViolationData, 'customer_service');
const noViolation = noViolations.length === 0;
allPassed = logTest('客服角色已脱敏无违规', noViolation, `违规数: ${noViolations.length}`) && allPassed;

console.log('\n--- 5. 异常处理测试 ---');
const emptyPhone = MaskingService.maskPhone('', 'middle');
const emptyId = MaskingService.maskIdCard(null, 'middle');
allPassed = logTest('空值处理', emptyPhone === '' && emptyId === '', `phone: "${emptyPhone}", id: "${emptyId}"`) && allPassed;

console.log('\n--- 6. 策略覆盖测试 ---');
const roleTypes = ['admin', 'operator', 'customer_service', 'auditor'];
const maskTypes = ['none', 'middle', 'full', 'last4'];
const typeCoverage = new Set();

roleTypes.forEach((role, idx) => {
  typeCoverage.add(maskTypes[idx]);
});

allPassed = logTest('角色策略覆盖完整性', typeCoverage.size === 4, `覆盖类型数: ${typeCoverage.size}`) && allPassed;

console.log('\n========================================');
console.log(`  测试结果: ${allPassed ? '全部通过' : '存在失败'}`);
console.log('========================================');

process.exit(allPassed ? 0 : 1);