const { test, describe } = require('node:test');
const assert = require('node:assert');
const { validateInventory } = require('../src/validator');

describe('Validator Module', function() {
  test('should detect cross-set items', function() {
    const records = [
      { '装备编号': 'CHAIR-001', '装备名称': '折叠椅', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 1 },
      { '装备编号': 'CHAIR-001', '装备名称': '折叠椅', '所属套装': '套装B', '数量': '3', '状态': '在库', '备注': '', lineNumber: 2 }
    ];
    
    const result = validateInventory(records);
    assert.strictEqual(result.issues.crossSetItems.length, 1);
    assert.strictEqual(result.issues.crossSetItems[0].equipmentId, 'CHAIR-001');
  });

  test('should detect handwritten notes', function() {
    const records = [
      { '装备编号': 'TENT-001', '装备名称': '帐篷', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '手写备注', lineNumber: 1 },
      { '装备编号': 'TENT-002', '装备名称': '帐篷', '所属套装': '套装B', '数量': '3', '状态': '在库', '备注': '手工补登', lineNumber: 2 }
    ];
    
    const result = validateInventory(records);
    assert.strictEqual(result.issues.handwrittenNotes.length, 2);
  });

  test('should detect duplicate records', function() {
    const records = [
      { '装备编号': 'TENT-001', '装备名称': '帐篷', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 1 },
      { '装备编号': 'TENT-001', '装备名称': '帐篷', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 2 }
    ];
    
    const result = validateInventory(records);
    assert.strictEqual(result.issues.duplicateRecords.length, 1);
  });

  test('should detect invalid status', function() {
    const records = [
      { '装备编号': 'TENT-001', '装备名称': '帐篷', '所属套装': '套装A', '数量': '2', '状态': '未知状态', '备注': '', lineNumber: 1 }
    ];
    
    const result = validateInventory(records);
    assert.strictEqual(result.issues.invalidStatus.length, 1);
  });

  test('should detect invalid quantity', function() {
    const records = [
      { '装备编号': 'TENT-001', '装备名称': '帐篷', '所属套装': '套装A', '数量': '-1', '状态': '在库', '备注': '', lineNumber: 1 }
    ];
    
    const result = validateInventory(records);
    assert.strictEqual(result.issues.invalidQuantity.length, 1);
  });

  test('should separate normal records from issues', function() {
    const records = [
      { '装备编号': 'TENT-001', '装备名称': '帐篷', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 1 },
      { '装备编号': 'BAD-001', '装备名称': '坏状态', '所属套装': '套装B', '数量': '1', '状态': '坏状态', '备注': '', lineNumber: 2 }
    ];
    
    const result = validateInventory(records);
    assert.strictEqual(result.normal.length, 1);
    assert.strictEqual(result.stats.total, 2);
    assert.strictEqual(result.stats.normal, 1);
  });

  test('should handle empty records', function() {
    const result = validateInventory([]);
    assert.strictEqual(result.normal.length, 0);
    assert.strictEqual(result.stats.total, 0);
  });
});
