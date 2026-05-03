const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { 
  ManifestReader, 
  SelectionsReader, 
  DEFAULT_MANIFEST 
} = require('../src/reader');
const { ValidationError } = require('../src/utils');

test('ManifestReader - 应该读取有效的 manifest.json', () => {
  const reader = new ManifestReader();
  const testManifest = {
    version: '1.0.0',
    requirements: {
      photoTypes: [
        {
          type: 'test_type',
          name: '测试类型',
          required: true,
          categories: ['refined']
        }
      ]
    }
  };
  
  const tempFile = path.join(__dirname, 'temp-manifest.json');
  fs.writeFileSync(tempFile, JSON.stringify(testManifest));
  
  const result = reader.read(tempFile);
  
  assert.strictEqual(result.version, '1.0.0');
  assert.strictEqual(result.requirements.photoTypes.length, 1);
  assert.strictEqual(result.requirements.photoTypes[0].type, 'test_type');
  
  fs.unlinkSync(tempFile);
});

test('ManifestReader - 应该对缺少 type 字段的类型配置抛出错误', () => {
  const reader = new ManifestReader();
  const invalidManifest = {
    version: '1.0.0',
    requirements: {
      photoTypes: [
        {
          name: '测试类型',
          required: true
        }
      ]
    }
  };
  
  const tempFile = path.join(__dirname, 'temp-invalid-manifest.json');
  fs.writeFileSync(tempFile, JSON.stringify(invalidManifest));
  
  assert.throws(
    () => reader.read(tempFile),
    ValidationError
  );
  
  fs.unlinkSync(tempFile);
});

test('ManifestReader - 应该对缺少 name 字段的类型配置抛出错误', () => {
  const reader = new ManifestReader();
  const invalidManifest = {
    version: '1.0.0',
    requirements: {
      photoTypes: [
        {
          type: 'test_type',
          required: true
        }
      ]
    }
  };
  
  const tempFile = path.join(__dirname, 'temp-invalid-manifest2.json');
  fs.writeFileSync(tempFile, JSON.stringify(invalidManifest));
  
  assert.throws(
    () => reader.read(tempFile),
    ValidationError
  );
  
  fs.unlinkSync(tempFile);
});

test('ManifestReader - getPhotoType 应该正确获取类型配置', () => {
  const reader = new ManifestReader();
  reader.manifest = DEFAULT_MANIFEST;
  
  const type = reader.getPhotoType('refined_watermark');
  
  assert.strictEqual(type.type, 'refined_watermark');
  assert.strictEqual(type.name, '精修带水印');
});

test('ManifestReader - getRequiredPhotoTypes 应该只返回必需的类型', () => {
  const reader = new ManifestReader();
  reader.manifest = DEFAULT_MANIFEST;
  
  const requiredTypes = reader.getRequiredPhotoTypes();
  
  for (const type of requiredTypes) {
    assert.strictEqual(type.required, true);
  }
});

test('ManifestReader - getAllPhotoTypes 应该返回所有类型', () => {
  const reader = new ManifestReader();
  reader.manifest = DEFAULT_MANIFEST;
  
  const allTypes = reader.getAllPhotoTypes();
  
  assert.strictEqual(allTypes.length, DEFAULT_MANIFEST.requirements.photoTypes.length);
});

test('SelectionsReader - readSync 应该正确读取有效的 CSV', () => {
  const reader = new SelectionsReader();
  const csvContent = `照片编号,类型,备注
1234,精修,测试备注1
1235,原片,测试备注2
1236,精修,`;
  
  const tempFile = path.join(__dirname, 'temp-selections.csv');
  fs.writeFileSync(tempFile, csvContent);
  
  const selections = reader.readSync(tempFile);
  
  assert.strictEqual(selections.length, 3);
  assert.strictEqual(selections[0].photoNumber, '1234');
  assert.strictEqual(selections[1].photoNumber, '1235');
  assert.strictEqual(selections[2].photoNumber, '1236');
  
  fs.unlinkSync(tempFile);
});

test('SelectionsReader - 应该对缺少编号列的 CSV 抛出错误', () => {
  const reader = new SelectionsReader();
  const csvContent = `名称,类型,备注
测试1,精修,备注`;
  
  const tempFile = path.join(__dirname, 'temp-invalid-selections.csv');
  fs.writeFileSync(tempFile, csvContent);
  
  assert.throws(
    () => reader.readSync(tempFile),
    ValidationError
  );
  
  fs.unlinkSync(tempFile);
});

test('SelectionsReader - 应该对重复的编号抛出错误', () => {
  const reader = new SelectionsReader();
  const csvContent = `照片编号,类型,备注
1234,精修,备注1
1234,原片,备注2`;
  
  const tempFile = path.join(__dirname, 'temp-duplicate-selections.csv');
  fs.writeFileSync(tempFile, csvContent);
  
  assert.throws(
    () => reader.readSync(tempFile),
    ValidationError
  );
  
  fs.unlinkSync(tempFile);
});

test('SelectionsReader - getPhotoNumbers 应该返回所有编号', () => {
  const reader = new SelectionsReader();
  reader.selections = [
    { photoNumber: '1234' },
    { photoNumber: '1235' },
    { photoNumber: '1236' }
  ];
  
  const numbers = reader.getPhotoNumbers();
  
  assert.deepStrictEqual(numbers, ['1234', '1235', '1236']);
});

test('SelectionsReader - getSelectionByNumber 应该根据编号查找选片', () => {
  const reader = new SelectionsReader();
  const targetSelection = { photoNumber: '1235', notes: 'test' };
  reader.selections = [
    { photoNumber: '1234' },
    targetSelection,
    { photoNumber: '1236' }
  ];
  
  const result = reader.getSelectionByNumber('1235');
  
  assert.strictEqual(result, targetSelection);
});

test('SelectionsReader - getSelectionByNumber 对不存在的编号应该返回 undefined', () => {
  const reader = new SelectionsReader();
  reader.selections = [
    { photoNumber: '1234' }
  ];
  
  const result = reader.getSelectionByNumber('9999');
  
  assert.strictEqual(result, undefined);
});
