const { validateSampleData, validateOptions, EXIT_CODES } = require('../src/validator.js');
const { normalizeData } = require('../src/reader.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('========================================');
console.log('Running validator tests...');
console.log('========================================\n');

test('TTL 为字符串应该被检测为错误', () => {
  const data = [{ key: 'test:1', memory: 1024, ttl: '3600' }];
  const result = validateSampleData(data);
  assert(result.isValid === false, '字符串 TTL 应该导致验证失败');
  assert(result.errors.some(e => e.includes('ttl 必须是数字类型')), '应该有数字类型错误');
});

test('TTL 为 -5 应该被检测为错误', () => {
  const data = [{ key: 'test:1', memory: 1024, ttl: -5 }];
  const result = validateSampleData(data);
  assert(result.isValid === false, 'TTL < -1 应该导致验证失败');
  assert(result.errors.some(e => e.includes('ttl 必须 >= -1')), '应该有范围错误');
});

test('TTL 为 -1 应该合法', () => {
  const data = [{ key: 'test:1', memory: 1024, ttl: -1 }];
  const result = validateSampleData(data);
  assert(result.isValid === true, 'TTL = -1 应该合法');
});

test('TTL 为 0 应该合法', () => {
  const data = [{ key: 'test:1', memory: 1024, ttl: 0 }];
  const result = validateSampleData(data);
  assert(result.isValid === true, 'TTL = 0 应该合法');
});

test('TTL 为 3600 应该合法', () => {
  const data = [{ key: 'test:1', memory: 1024, ttl: 3600 }];
  const result = validateSampleData(data);
  assert(result.isValid === true, 'TTL = 3600 应该合法');
});

test('TTL 为 null 应该被检测为错误', () => {
  const data = [{ key: 'test:1', memory: 1024, ttl: null }];
  const result = validateSampleData(data);
  assert(result.isValid === false, 'TTL = null 应该导致验证失败');
});

test('memory 为负数应该被检测为错误', () => {
  const data = [{ key: 'test:1', memory: -100, ttl: 3600 }];
  const result = validateSampleData(data);
  assert(result.isValid === false, '内存为负应该导致验证失败');
});

test('缺少 key 字段应该被检测为错误', () => {
  const data = [{ memory: 1024, ttl: 3600 }];
  const result = validateSampleData(data);
  assert(result.isValid === false, '缺少 key 应该导致验证失败');
});

test('缺少 memory 字段应该被检测为错误', () => {
  const data = [{ key: 'test:1', ttl: 3600 }];
  const result = validateSampleData(data);
  assert(result.isValid === false, '缺少 memory 应该导致验证失败');
});

test('干净样本数据应该通过验证', () => {
  const data = [
    { key: 'user:session:1001', memory: 1536, ttl: 3600, type: 'string' },
    { key: 'user:profile:2001', memory: 8192, ttl: -1, type: 'hash' }
  ];
  const result = validateSampleData(data);
  assert(result.isValid === true, '干净数据应该通过验证');
});

console.log('\n========================================');
console.log('Running normalizeData tests...');
console.log('========================================\n');

test('normalizeData 应该将无效 TTL 转为 -1', () => {
  const data = [
    { key: 'test:1', memory: 1024, ttl: '3600' },
    { key: 'test:2', memory: 2048, ttl: -5 },
    { key: 'test:3', memory: 3072, ttl: null }
  ];
  const normalized = normalizeData(data);
  assert(normalized[0].ttl === -1, '字符串 TTL 应转为 -1');
  assert(normalized[1].ttl === -1, '负 TTL 应转为 -1');
  assert(normalized[2].ttl === -1, 'null TTL 应转为 -1');
});

test('normalizeData 应该保留有效 TTL', () => {
  const data = [
    { key: 'test:1', memory: 1024, ttl: 3600 },
    { key: 'test:2', memory: 2048, ttl: -1 }
  ];
  const normalized = normalizeData(data);
  assert(normalized[0].ttl === 3600, '有效 TTL 应保留');
  assert(normalized[1].ttl === -1, '-1 TTL 应保留');
});

console.log('\n========================================');
console.log('Running option validation tests...');
console.log('========================================\n');

test('无效 sample-rate 应该被检测', () => {
  const options = { input: 'test.json', sampleRate: '2.0' };
  const result = validateOptions(options);
  assert(result.isValid === false, '无效采样率应该失败');
});

test('无效 format 应该被检测', () => {
  const options = { input: 'test.json', format: 'invalid' };
  const result = validateOptions(options);
  assert(result.isValid === false, '无效格式应该失败');
});

test('缺少 input 应该被检测', () => {
  const options = {};
  const result = validateOptions(options);
  assert(result.isValid === false, '缺少 input 应该失败');
});

console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
