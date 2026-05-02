const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { Validator, VALIDATION_RULES, RULE_SEVERITY } = require('../src/validator');

test.describe('Validator', () => {
  let tempDir;
  let validator;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-checker-test-'));
    validator = new Validator({
      workspaceRoot: tempDir
    });
  });

  test.afterEach(async () => {
    await fs.remove(tempDir);
  });

  test.it('should validate file extension correctly', () => {
    const validPhoto = {
      path: 'test/CUL-0001.jpg',
      name: 'CUL-0001.jpg',
      extension: '.jpg'
    };

    const invalidPhoto = {
      path: 'test/invalid.txt',
      name: 'invalid.txt',
      extension: '.txt'
    };

    const validResult = validator.validateExtension(validPhoto);
    const invalidResult = validator.validateExtension(invalidPhoto);

    assert.strictEqual(validResult.passed, true);
    assert.strictEqual(invalidResult.passed, false);
    assert.strictEqual(invalidResult.rule, VALIDATION_RULES.EXTENSION_VALID);
  });

  test.it('should validate filename format with collection ID', () => {
    const validPhoto = {
      path: 'test/CUL-0001-front.jpg',
      name: 'CUL-0001-front.jpg',
      extension: '.jpg'
    };

    const invalidPhoto = {
      path: 'test/invalid_name.jpg',
      name: 'invalid_name.jpg',
      extension: '.jpg'
    };

    const validResult = validator.validateFilenameFormat(validPhoto);
    const invalidResult = validator.validateFilenameFormat(invalidPhoto);

    assert.strictEqual(validResult.passed, true);
    assert.strictEqual(invalidResult.passed, false);
    assert.strictEqual(invalidResult.rule, VALIDATION_RULES.FILENAME_FORMAT);
  });

  test.it('should validate collection ID format', () => {
    const photo = { path: 'test/CUL-0001.jpg', name: 'CUL-0001.jpg' };

    const validResult = validator.validateCollectionIdFormat(photo, 'CUL-0001');
    const invalidResult = validator.validateCollectionIdFormat(photo, 'invalid-id');

    assert.strictEqual(validResult.passed, true);
    assert.strictEqual(invalidResult.passed, false);
  });

  test.it('should validate collection ID exists in catalog', () => {
    const photo = { path: 'test/CUL-0001.jpg', name: 'CUL-0001.jpg' };
    const catalog = {
      items: [
        { id: 'CUL-0001', name: 'Test Item 1' },
        { id: 'CUL-0002', name: 'Test Item 2' }
      ]
    };

    const existsResult = validator.validateCollectionIdExists(photo, 'CUL-0001', catalog);
    const notExistsResult = validator.validateCollectionIdExists(photo, 'CUL-9999', catalog);

    assert.strictEqual(existsResult.passed, true);
    assert.strictEqual(notExistsResult.passed, false);
  });

  test.it('should detect duplicate files by hash', () => {
    const photos = [
      { path: 'test/photo1.jpg', name: 'photo1.jpg', hash: 'abc123' },
      { path: 'test/photo2.jpg', name: 'photo2.jpg', hash: 'abc123' },
      { path: 'test/photo3.jpg', name: 'photo3.jpg', hash: 'def456' }
    ];

    const results = validator.validateDuplicateHash(photos);
    
    const duplicateResult = results.find(r => !r.passed);
    assert.ok(duplicateResult, 'Should find duplicate');
    assert.strictEqual(duplicateResult.rule, VALIDATION_RULES.DUPLICATE_HASH);
    assert.strictEqual(duplicateResult.context.count, 2);
  });

  test.it('should detect non-unique filenames', () => {
    const photos = [
      { path: 'test/photo1.jpg', name: 'CUL-0001.jpg' },
      { path: 'test/subdir/CUL-0001.jpg', name: 'CUL-0001.jpg' },
      { path: 'test/CUL-0002.jpg', name: 'CUL-0002.jpg' }
    ];

    const results = validator.validateFilenameUniqueness(photos);
    
    const conflictResult = results.find(r => !r.passed);
    assert.ok(conflictResult, 'Should find filename conflict');
    assert.strictEqual(conflictResult.rule, VALIDATION_RULES.FILENAME_UNIQUENESS);
  });

  test.it('should validate photo count limit per collection', () => {
    const photos = [];
    for (let i = 0; i < 15; i++) {
      photos.push({
        path: `test/CUL-0001-${i}.jpg`,
        name: `CUL-0001-${i}.jpg`
      });
    }

    const results = validator.validatePhotoCountLimit(photos);
    
    const limitResult = results.find(r => !r.passed);
    assert.ok(limitResult, 'Should find photos exceeding count limit');
    assert.strictEqual(limitResult.rule, VALIDATION_RULES.PHOTO_COUNT_LIMIT);
  });

  test.it('should extract collection ID from filename', () => {
    const collectionId = validator.extractCollectionIdFromFilename('CUL-0001-front.jpg');
    assert.strictEqual(collectionId, 'CUL-0001');

    const noMatch = validator.extractCollectionIdFromFilename('invalid-filename.jpg');
    assert.strictEqual(noMatch, null);
  });

  test.it('should validate shooting list match', () => {
    const photos = [
      { path: 'test/CUL-0001.jpg', name: 'CUL-0001.jpg' },
      { path: 'test/CUL-0002.jpg', name: 'CUL-0002.jpg' }
    ];

    const shootingList = [
      { id: 'CUL-0001' },
      { id: 'CUL-0003' }
    ];

    const results = validator.validateShootingListMatch(photos, shootingList);
    
    assert.ok(results.length > 0, 'Should have mismatch results');
    
    const missingResult = results.find(r => r.message.includes('缺少'));
    const unexpectedResult = results.find(r => r.message.includes('没有'));
    
    assert.ok(missingResult, 'Should find missing in photos');
    assert.ok(unexpectedResult, 'Should find unexpected in photos');
  });
});
