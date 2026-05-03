const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { 
  ValidationError, 
  formatError, 
  validateDirectory, 
  validateFile,
  ensureDirectory,
  safeJSONParse
} = require('../src/utils');

test('ValidationError - 应该正确创建自定义错误', () => {
  const error = new ValidationError(
    '测试错误消息',
    'TEST_ERROR',
    { field: 'test' }
  );
  
  assert.strictEqual(error.message, '测试错误消息');
  assert.strictEqual(error.code, 'TEST_ERROR');
  assert.deepStrictEqual(error.details, { field: 'test' });
  assert.strictEqual(error.name, 'ValidationError');
});

test('formatError - 应该正确格式化 ValidationError', () => {
  const error = new ValidationError(
    '测试错误',
    'TEST_CODE',
    { details: 'info' }
  );
  
  const formatted = formatError(error);
  
  assert.strictEqual(formatted.success, false);
  assert.strictEqual(formatted.error.message, '测试错误');
  assert.strictEqual(formatted.error.code, 'TEST_CODE');
  assert.deepStrictEqual(formatted.error.details, { details: 'info' });
});

test('formatError - 应该正确格式化文件不存在错误', () => {
  const error = new Error('File not found');
  error.code = 'ENOENT';
  error.path = '/test/path';
  
  const formatted = formatError(error);
  
  assert.strictEqual(formatted.success, false);
  assert.strictEqual(formatted.error.code, 'FILE_NOT_FOUND');
  assert.strictEqual(formatted.error.details.path, '/test/path');
});

test('formatError - 应该正确格式化权限错误', () => {
  const error = new Error('Permission denied');
  error.code = 'EACCES';
  error.path = '/test/path';
  
  const formatted = formatError(error);
  
  assert.strictEqual(formatted.success, false);
  assert.strictEqual(formatted.error.code, 'PERMISSION_DENIED');
});

test('formatError - 应该正确格式化 JSON 解析错误', () => {
  const error = new SyntaxError('Unexpected token');
  error.name = 'SyntaxError';
  
  const formatted = formatError(error);
  
  assert.strictEqual(formatted.success, false);
  assert.strictEqual(formatted.error.code, 'JSON_PARSE_ERROR');
});

test('validateDirectory - 应该验证存在的目录', () => {
  const tempDir = path.join(__dirname, 'temp-test-dir');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const result = validateDirectory(tempDir);
  
  assert.strictEqual(result.exists, true);
  assert.strictEqual(result.isDirectory, true);
  
  fs.rmdirSync(tempDir);
});

test('validateDirectory - 应该对不存在的目录抛出错误（当 required 时）', () => {
  const nonExistentPath = '/non/existent/path';
  
  assert.throws(
    () => validateDirectory(nonExistentPath, { required: true }),
    ValidationError
  );
});

test('validateDirectory - 不应该对不存在的目录抛出错误（当 required 为 false 时）', () => {
  const nonExistentPath = '/non/existent/path';
  
  const result = validateDirectory(nonExistentPath, { required: false });
  
  assert.strictEqual(result.exists, false);
  assert.strictEqual(result.isDirectory, false);
});

test('validateFile - 应该验证存在的文件', () => {
  const tempFile = path.join(__dirname, 'temp-test-file.txt');
  fs.writeFileSync(tempFile, 'test content');
  
  const result = validateFile(tempFile);
  
  assert.strictEqual(result.exists, true);
  assert.strictEqual(result.isFile, true);
  
  fs.unlinkSync(tempFile);
});

test('validateFile - 应该验证文件扩展名', () => {
  const tempFile = path.join(__dirname, 'temp-test-file.json');
  fs.writeFileSync(tempFile, '{}');
  
  const result = validateFile(tempFile, { extensions: ['.json', '.js'] });
  
  assert.strictEqual(result.exists, true);
  
  fs.unlinkSync(tempFile);
});

test('validateFile - 应该对错误的扩展名抛出错误', () => {
  const tempFile = path.join(__dirname, 'temp-test-file.txt');
  fs.writeFileSync(tempFile, 'test content');
  
  assert.throws(
    () => validateFile(tempFile, { extensions: ['.json'] }),
    ValidationError
  );
  
  fs.unlinkSync(tempFile);
});

test('ensureDirectory - 应该创建不存在的目录', () => {
  const tempDir = path.join(__dirname, 'nested', 'test', 'dir');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  
  const result = ensureDirectory(tempDir);
  
  assert.strictEqual(fs.existsSync(tempDir), true);
  assert.strictEqual(result, tempDir);
  
  fs.rmSync(path.join(__dirname, 'nested'), { recursive: true });
});

test('safeJSONParse - 应该正确解析有效的 JSON', () => {
  const jsonStr = '{"name": "test", "value": 123}';
  
  const result = safeJSONParse(jsonStr, 'test.json');
  
  assert.deepStrictEqual(result, { name: 'test', value: 123 });
});

test('safeJSONParse - 应该对无效的 JSON 抛出 ValidationError', () => {
  const invalidJson = '{invalid: json}';
  
  assert.throws(
    () => safeJSONParse(invalidJson, 'test.json'),
    ValidationError
  );
});
