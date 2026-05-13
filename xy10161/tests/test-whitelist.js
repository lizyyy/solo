const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { Whitelist } = require('../src/whitelist');

test('Whitelist: 应正确匹配白名单条目', (t) => {
  const whitelist = new Whitelist();
  const whitelistFile = path.join(__dirname, '../config/whitelist.json');
  whitelist.loadFromFile(whitelistFile);
  
  const finding = {
    ruleId: 'email',
    match: 'test@example.com',
    source: 'test.txt',
    line: 1,
    column: 1
  };
  
  const result = whitelist.isWhitelisted(finding);
  assert.strictEqual(result.whitelisted, true, '应识别为白名单');
});

test('Whitelist: 应正确排除白名单问题', (t) => {
  const whitelist = new Whitelist();
  const whitelistFile = path.join(__dirname, '../config/whitelist.json');
  whitelist.loadFromFile(whitelistFile);
  
  const findings = [
    { ruleId: 'email', match: 'test@example.com', source: 'test.txt' },
    { ruleId: 'phone', match: '13800138000', source: 'test.txt' },
    { ruleId: 'token', match: 'token: internal-debug-token-12345', source: 'test.txt' }
  ];
  
  const result = whitelist.filterFindings(findings);
  assert.strictEqual(result.allowed.length, 1, '应允许 1 个问题（手机号不在白名单）');
  assert.strictEqual(result.excluded.length, 2, '应排除 2 个问题（邮箱和 token 在白名单）');
});

test('Whitelist: 不应匹配非白名单问题', (t) => {
  const whitelist = new Whitelist();
  const whitelistFile = path.join(__dirname, '../config/whitelist.json');
  whitelist.loadFromFile(whitelistFile);
  
  const finding = {
    ruleId: 'phone',
    match: '13800138000',
    source: 'test.txt'
  };
  
  const result = whitelist.isWhitelisted(finding);
  assert.strictEqual(result.whitelisted, false, '手机号不应在白名单中');
});
