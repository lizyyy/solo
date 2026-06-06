const { checkSamplingGap, checkSamplingDuration, runAllBoundaryChecks, BOUNDARY_RULES } = require('../src/models/boundary-rules');

console.log('='.repeat(60));
console.log('🧪 边界规则单元测试');
console.log('='.repeat(60));
console.log('');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌  FAIL: ${name}`);
    console.log(`   ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败');
}

console.log(`规则 1: 采样间隔 > ${BOUNDARY_RULES.MAX_SAMPLING_GAP_MINUTES} 分钟判定为异常`);
console.log('-'.repeat(60));

test('采样间隔 25 分钟 - 正常', () => {
  const prev = { sampling_end_time: '2024-06-15T08:00:00.000Z' };
  const curr = { sampling_start_time: '2024-06-15T08:25:00.000Z' };
  const result = checkSamplingGap(curr, prev);
  assert(result.hasIssue === false, '间隔25分钟不应判定为异常');
});

test('采样间隔 35 分钟 - 异常', () => {
  const prev = { sampling_end_time: '2024-06-15T08:00:00.000Z' };
  const curr = { sampling_start_time: '2024-06-15T08:35:00.000Z' };
  const result = checkSamplingGap(curr, prev);
  assert(result.hasIssue === true, '间隔35分钟应判定为异常');
  assert(result.issueType === 'SAMPLING_GAP_EXCEEDED', '问题类型应为 SAMPLING_GAP_EXCEEDED');
});

test('无前置记录 - 正常', () => {
  const curr = { sampling_start_time: '2024-06-15T08:00:00.000Z' };
  const result = checkSamplingGap(curr, null);
  assert(result.hasIssue === false, '无前置记录不应判定为异常');
});

console.log('');
console.log(`规则 2: 采样时长 < 理论值的 ${BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO * 100}% 判定为异常`);
console.log(`       理论采样时长: ${BOUNDARY_RULES.THEORETICAL_SAMPLING_MINUTES} 分钟`);
console.log(`       最小要求: ${BOUNDARY_RULES.THEORETICAL_SAMPLING_MINUTES * BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO} 分钟`);
console.log('-'.repeat(60));

test('采样时长 60 分钟 - 正常', () => {
  const record = {
    sampling_start_time: '2024-06-15T08:00:00.000Z',
    sampling_end_time: '2024-06-15T09:00:00.000Z'
  };
  const result = checkSamplingDuration(record);
  assert(result.hasIssue === false, '时长60分钟不应判定为异常');
});

test('采样时长 35 分钟 - 正常', () => {
  const record = {
    sampling_start_time: '2024-06-15T08:00:00.000Z',
    sampling_end_time: '2024-06-15T08:35:00.000Z'
  };
  const result = checkSamplingDuration(record);
  assert(result.hasIssue === false, '时长35分钟不应判定为异常');
});

test('采样时长 20 分钟 - 异常', () => {
  const record = {
    sampling_start_time: '2024-06-15T08:00:00.000Z',
    sampling_end_time: '2024-06-15T08:20:00.000Z'
  };
  const result = checkSamplingDuration(record);
  assert(result.hasIssue === true, '时长20分钟应判定为异常');
  assert(result.issueType === 'SAMPLING_DURATION_TOO_SHORT', '问题类型应为 SAMPLING_DURATION_TOO_SHORT');
});

test('无起止时间 - 不检查', () => {
  const record = { sampling_time: '2024-06-15T08:00:00.000Z' };
  const result = checkSamplingDuration(record);
  assert(result.hasIssue === false, '无起止时间不应触发检查');
});

console.log('');
console.log('规则 3: 综合边界检查');
console.log('-'.repeat(60));

test('同时触发两个边界问题', () => {
  const prev = { sampling_end_time: '2024-06-15T08:00:00.000Z' };
  const curr = {
    sampling_start_time: '2024-06-15T08:45:00.000Z',
    sampling_end_time: '2024-06-15T08:55:00.000Z'
  };
  const result = runAllBoundaryChecks(curr, prev);
  assert(result.hasIssues === true, '应检测到问题');
  assert(result.issues.length === 2, '应检测到2个问题');
  assert(result.autoStatus !== null, '应自动建议状态');
  console.log(`   检测到的问题: ${result.issues.map(i => i.issueType).join(', ')}`);
  console.log(`   自动建议状态: ${result.autoStatus}`);
});

test('正常数据无问题', () => {
  const prev = { sampling_end_time: '2024-06-15T08:00:00.000Z' };
  const curr = {
    sampling_start_time: '2024-06-15T08:20:00.000Z',
    sampling_end_time: '2024-06-15T09:20:00.000Z'
  };
  const result = runAllBoundaryChecks(curr, prev);
  assert(result.hasIssues === false, '正常数据不应有问题');
  assert(result.issues.length === 0, '问题列表应为空');
  assert(result.autoStatus === null, '不应自动建议状态');
});

console.log('');
console.log('='.repeat(60));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
