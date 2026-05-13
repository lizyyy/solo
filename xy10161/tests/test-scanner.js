const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { Scanner } = require('../src/scanner');
const { RuleLoader } = require('../src/rules');

test('Scanner: 应检测手机号', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const scanner = new Scanner(loader.getRules());
  
  const result = scanner.scanText('用户手机号：13800138000');
  
  assert.strictEqual(result.success, true, '扫描应成功');
  assert.ok(result.findings.some(f => f.ruleId === 'phone'), '应检测到手机号');
});

test('Scanner: 应检测身份证号', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const scanner = new Scanner(loader.getRules());
  
  const result = scanner.scanText('身份证号：110101199001011234');
  
  assert.strictEqual(result.success, true, '扫描应成功');
  assert.ok(result.findings.some(f => f.ruleId === 'idCard'), '应检测到身份证号');
});

test('Scanner: 应计算正确的统计信息', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const scanner = new Scanner(loader.getRules());
  
  const result = scanner.scanText('手机号：13800138000，身份证：110101199001011234，邮箱：test@example.com');
  
  assert.strictEqual(result.stats.critical, 1, '应有 1 个 critical 问题（身份证）');
  assert.strictEqual(result.stats.high, 1, '应有 1 个 high 问题（手机号）');
  assert.strictEqual(result.stats.medium, 1, '应有 1 个 medium 问题（邮箱）');
  assert.strictEqual(result.stats.shouldBlock, true, '应阻断发布');
});

test('Scanner: 应从文件扫描', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const scanner = new Scanner(loader.getRules());
  
  const logFile = path.join(__dirname, '../samples/log-sample-1.txt');
  const result = scanner.scanFile(logFile);
  
  assert.strictEqual(result.success, true, '扫描应成功');
  assert.ok(result.findings.length > 0, '应发现问题');
});

test('Scanner: 应扫描干净的日志', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const scanner = new Scanner(loader.getRules());
  
  const logFile = path.join(__dirname, '../samples/clean-log.txt');
  const result = scanner.scanFile(logFile);
  
  assert.strictEqual(result.success, true, '扫描应成功');
  assert.strictEqual(result.findings.length, 0, '干净日志不应发现问题');
  assert.strictEqual(result.stats.shouldBlock, false, '不应阻断发布');
});
