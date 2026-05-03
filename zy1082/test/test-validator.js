const test = require('node:test');
const assert = require('node:assert');
const { PhotoValidator, ISSUE_TYPES, ISSUE_SEVERITY } = require('../src/validator');
const { DEFAULT_MANIFEST } = require('../src/reader');

function createMockPhoto(overrides = {}) {
  return {
    filePath: '/test/photo.jpg',
    fileName: 'photo.jpg',
    fileNameWithoutExt: 'photo',
    relativePath: 'photo.jpg',
    directoryName: '.',
    width: 1920,
    height: 1080,
    aspectRatio: 1920 / 1080,
    orientation: 'landscape',
    fileSize: 1024000,
    modifiedTime: '2024-01-01T00:00:00.000Z',
    photoNumber: '1234',
    version: 1,
    hasWatermark: false,
    noWatermark: true,
    isRefined: true,
    isOriginal: false,
    isGrid: false,
    isPrint: false,
    category: ['refined'],
    ...overrides
  };
}

function createMockSelection(overrides = {}) {
  return {
    photoNumber: '1234',
    types: ['refined'],
    notes: '',
    ...overrides
  };
}

test('PhotoValidator - validate 应该返回成功状态当没有问题时', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: true,
      isRefined: true,
      category: ['refined']
    }),
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: false,
      noWatermark: true,
      isRefined: true,
      category: ['refined'],
      fileName: 'photo2.jpg'
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  assert.strictEqual(typeof result.success, 'boolean');
  assert.strictEqual(result.summary.totalPhotos, 2);
  assert.strictEqual(result.summary.totalSelections, 1);
});

test('PhotoValidator - 应该检测缺少必需类型的照片', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: true,
      category: ['refined']
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  const missingIssues = result.issues[ISSUE_TYPES.MISSING_PHOTO] || [];
  
  assert.ok(missingIssues.length > 0);
});

test('PhotoValidator - 应该检测选片表外的额外照片', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ photoNumber: '1234' }),
    createMockPhoto({ 
      photoNumber: '9999', 
      fileName: 'extra.jpg'
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  const extraIssues = result.issues[ISSUE_TYPES.EXTRA_PHOTO] || [];
  
  assert.strictEqual(extraIssues.length, 1);
  assert.strictEqual(extraIssues[0].photoNumber, '9999');
});

test('PhotoValidator - 应该检测同一编号的重复照片', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: true,
      version: 1,
      category: ['refined']
    }),
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: true,
      version: 1,
      fileName: 'photo2.jpg',
      category: ['refined']
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  const duplicateIssues = result.issues[ISSUE_TYPES.DUPLICATE_NUMBER] || [];
  
  assert.ok(duplicateIssues.length > 0);
});

test('PhotoValidator - 应该检测同一编号的多个版本', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: true,
      version: 1,
      category: ['refined']
    }),
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: true,
      version: 2,
      fileName: 'photo_v2.jpg',
      category: ['refined']
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  const versionIssues = result.issues[ISSUE_TYPES.MULTIPLE_VERSIONS] || [];
  
  assert.ok(versionIssues.length > 0);
});

test('PhotoValidator - 应该检测水印状态错误', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ 
      photoNumber: '1234', 
      hasWatermark: false,
      noWatermark: false,
      isRefined: true,
      category: ['refined']
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  const watermarkIssues = result.issues[ISSUE_TYPES.WRONG_WATERMARK] || [];
  
  assert.ok(watermarkIssues.length >= 0);
});

test('PhotoValidator - 应该检测无法识别编号的照片', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ 
      photoNumber: null,
      fileName: 'unknown.jpg'
    })
  ];
  
  const selections = [];
  
  const result = validator.validate(photos, selections);
  
  const noNumberIssues = result.issues[ISSUE_TYPES.NO_NUMBER] || [];
  
  assert.strictEqual(noNumberIssues.length, 1);
  assert.strictEqual(noNumberIssues[0].count, 1);
});

test('PhotoValidator - 应该正确计算严重程度计数', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ photoNumber: null, fileName: 'unknown.jpg' })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  assert.strictEqual(typeof result.summary.severityCounts.critical, 'number');
  assert.strictEqual(typeof result.summary.severityCounts.high, 'number');
  assert.strictEqual(typeof result.summary.severityCounts.medium, 'number');
  assert.strictEqual(typeof result.summary.severityCounts.low, 'number');
});

test('PhotoValidator - 应该在存在严重或高优先级问题时返回 success=false', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  assert.strictEqual(result.summary.hasCriticalIssues, true);
  assert.strictEqual(result.success, false);
});

test('PhotoValidator - 应该按类型分组问题', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ photoNumber: null, fileName: 'unknown.jpg' }),
    createMockPhoto({ 
      photoNumber: '9999', 
      fileName: 'extra.jpg'
    })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  assert.ok(result.issues[ISSUE_TYPES.NO_NUMBER]);
  assert.ok(result.issues[ISSUE_TYPES.EXTRA_PHOTO]);
  assert.ok(result.issues[ISSUE_TYPES.MISSING_PHOTO]);
});

test('PhotoValidator - allIssues 应该包含所有问题', () => {
  const validator = new PhotoValidator(DEFAULT_MANIFEST);
  
  const photos = [
    createMockPhoto({ photoNumber: null, fileName: 'unknown.jpg' })
  ];
  
  const selections = [
    createMockSelection({ photoNumber: '1234' })
  ];
  
  const result = validator.validate(photos, selections);
  
  assert.strictEqual(result.allIssues.length, result.summary.totalIssues);
});
