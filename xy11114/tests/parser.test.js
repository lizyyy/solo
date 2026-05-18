const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseInventoryFile } = require('../src/parser');

describe('Parser Module', function() {
  const testDataDir = path.join(__dirname, 'test_data');
  
  beforeEach(function() {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  test('should parse valid CSV file correctly', function() {
    const filePath = path.join(testDataDir, 'valid.csv');
    fs.writeFileSync(filePath, `装备编号,装备名称,所属套装,数量,状态,备注
TENT-001,双人帐篷,帐篷套装A,2,在库,
CHAIR-001,折叠椅,桌椅套装A,5,在库,
`);
    
    const result = parseInventoryFile(filePath);
    assert.strictEqual(result.valid.length, 2);
    assert.strictEqual(result.invalid.length, 0);
    assert.strictEqual(result.stats.total, 2);
    assert.strictEqual(result.valid[0]['装备编号'], 'TENT-001');
  });

  test('should handle bad formatted lines', function() {
    const filePath = path.join(testDataDir, 'bad_format.csv');
    fs.writeFileSync(filePath, `装备编号,装备名称,所属套装,数量,状态,备注
TENT-001,双人帐篷,帐篷套装A,2,在库,
这是一行坏数据
,
`);
    
    const result = parseInventoryFile(filePath);
    assert.ok(result.invalid.length > 0, '应该检测到坏行');
  });

  test('should handle empty file', function() {
    const filePath = path.join(testDataDir, 'empty.csv');
    fs.writeFileSync(filePath, '');
    
    const result = parseInventoryFile(filePath);
    assert.strictEqual(result.valid.length, 0);
    assert.strictEqual(result.invalid.length, 0);
  });

  test('should handle file with only header', function() {
    const filePath = path.join(testDataDir, 'only_header.csv');
    fs.writeFileSync(filePath, '装备编号,装备名称,所属套装,数量,状态,备注\n');
    
    const result = parseInventoryFile(filePath);
    assert.strictEqual(result.valid.length, 0);
  });

  test('should throw error for non-existent file', function() {
    assert.throws(() => {
      parseInventoryFile(path.join(testDataDir, 'nonexistent.csv'));
    }, /文件不存在/);
  });

  afterEach(function() {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });
});
