const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { RuleLoader } = require('../src/rules');

test('RuleLoader: 应加载默认规则', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const rules = loader.getRules();
  assert.strictEqual(rules.length, 4, '应加载 4 条默认规则');
});

test('RuleLoader: 应正确识别严重级别', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  const rules = loader.getRules();
  
  const phone = rules.find(r => r.id === 'phone');
  const idCard = rules.find(r => r.id === 'idCard');
  
  assert.strictEqual(phone?.severity, 'high', '手机号严重级别应为 high');
  assert.strictEqual(idCard?.severity, 'critical', '身份证号严重级别应为 critical');
});

test('RuleLoader: 应从文件加载自定义规则', (t) => {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  
  const rulesFile = path.join(__dirname, '../config/rules.json');
  const result = loader.loadFromFile(rulesFile);
  
  assert.strictEqual(result.success, true, '加载应成功');
  assert.ok(result.added.includes('bankCard'), '应新增 bankCard 规则');
});

test('RuleLoader: 应检测无效规则', (t) => {
  const loader = new RuleLoader();
  const badRulesFile = path.join(__dirname, '../config/bad-rules.json');
  const result = loader.loadFromFile(badRulesFile);
  
  assert.strictEqual(result.success, true, '加载应成功（即使有无效规则）');
  assert.ok(result.invalid.length > 0, '应检测到无效规则');
});
