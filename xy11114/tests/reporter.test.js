const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { generateReports, listReports, generateTimestamp } = require('../src/reporter');

describe('Reporter Module', function() {
  const testOutputDir = path.join(__dirname, 'test_output');

  beforeEach(function() {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  test('should generate timestamp', function() {
    const timestamp = generateTimestamp();
    assert.ok(timestamp.length > 0);
    assert.ok(!timestamp.includes(':'));
    assert.ok(!timestamp.includes('.'));
  });

  test('should generate reports with classification', function() {
    const parseResult = {
      valid: [
        { '装备编号': 'TENT-001', '装备名称': '双人帐篷', '所属套装': '帐篷套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 1 }
      ],
      invalid: [],
      stats: { total: 1, valid: 1, invalid: 0 }
    };

    const validateResult = {
      normal: parseResult.valid,
      issues: {
        crossSetItems: [],
        handwrittenNotes: [],
        duplicateRecords: [],
        invalidStatus: [],
        invalidQuantity: []
      },
      stats: { total: 1, normal: 1, issuesCount: {} }
    };

    const result = generateReports(parseResult, validateResult, testOutputDir);
    assert.ok(result.files.length > 0);
    assert.ok(result.files.some(f => f.name.includes('正常清点结果')));
    assert.ok(result.files.some(f => f.name.includes('汇总报告')));
  });

  test('should generate issue reports for cross-set items', function() {
    const parseResult = {
      valid: [
        { '装备编号': 'CHAIR-001', '装备名称': '折叠椅', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 1 },
        { '装备编号': 'CHAIR-001', '装备名称': '折叠椅', '所属套装': '套装B', '数量': '3', '状态': '在库', '备注': '', lineNumber: 2 }
      ],
      invalid: [],
      stats: { total: 2, valid: 2, invalid: 0 }
    };

    const validateResult = {
      normal: [],
      issues: {
        crossSetItems: [{ equipmentId: 'CHAIR-001', equipmentName: '折叠椅', sets: ['套装A', '套装B'], records: parseResult.valid }],
        handwrittenNotes: [],
        duplicateRecords: [],
        invalidStatus: [],
        invalidQuantity: []
      },
      stats: { total: 2, normal: 0, issuesCount: { crossSetItems: 1 } }
    };

    const result = generateReports(parseResult, validateResult, testOutputDir);
    assert.ok(result.files.some(f => f.name.includes('同配件跨套装')));
  });

  test('should list reports correctly', function() {
    const reports = listReports(testOutputDir);
    assert.ok(Array.isArray(reports));
  });

  test('should handle empty directory for listing', function() {
    const emptyDir = path.join(testOutputDir, 'empty');
    if (!fs.existsSync(emptyDir)) {
      fs.mkdirSync(emptyDir);
    }
    const reports = listReports(emptyDir);
    assert.deepStrictEqual(reports, []);
    fs.rmdirSync(emptyDir);
  });

  test('should generate different filenames with timestamps', function() {
    const parseResult = {
      valid: [{ '装备编号': 'TENT-001', '装备名称': '双人帐篷', '所属套装': '套装A', '数量': '2', '状态': '在库', '备注': '', lineNumber: 1 }],
      invalid: [],
      stats: { total: 1, valid: 1, invalid: 0 }
    };

    const validateResult = {
      normal: parseResult.valid,
      issues: { crossSetItems: [], handwrittenNotes: [], duplicateRecords: [], invalidStatus: [], invalidQuantity: [] },
      stats: { total: 1, normal: 1, issuesCount: {} }
    };

    const result1 = generateReports(parseResult, validateResult, testOutputDir);
    const files = listReports(testOutputDir);
    assert.ok(files.length >= 2);
    assert.ok(files.every(f => f.name.includes(result1.timestamp)));
  });

  afterEach(function() {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });
});
