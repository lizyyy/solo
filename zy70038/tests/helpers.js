const fs = require('fs');
const path = require('path');

const TEST_DATA_DIR = path.join(process.cwd(), 'data-test');
const TEST_EXPORT_DIR = path.join(process.cwd(), 'exports-test');

function setupTestEnvironment() {
  process.env.TEST_MODE = 'true';
  
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_EXPORT_DIR)) {
    fs.mkdirSync(TEST_EXPORT_DIR, { recursive: true });
  }
  
  const dataFiles = ['orders.json', 'inventory.json', 'stock-operations.json', 'exceptions.json', 'pickup-codes.json'];
  dataFiles.forEach(file => {
    const filePath = path.join(TEST_DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    }
  });
}

function cleanupTestEnvironment() {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(TEST_EXPORT_DIR)) {
    fs.rmSync(TEST_EXPORT_DIR, { recursive: true, force: true });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 断言失败: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`❌ ${message}: 期望 ${expected}, 实际 ${actual}`);
  }
  console.log(`  ✅ ${message}`);
}

function assertSuccess(result, message) {
  if (!result || !result.success) {
    throw new Error(`❌ ${message}: ${result ? result.reason : '未知错误'}`);
  }
  console.log(`  ✅ ${message}`);
}

function assertFail(result, message) {
  if (result && result.success) {
    throw new Error(`❌ ${message}: 期望失败但实际成功`);
  }
  console.log(`  ✅ ${message}`);
}

module.exports = {
  TEST_DATA_DIR,
  TEST_EXPORT_DIR,
  setupTestEnvironment,
  cleanupTestEnvironment,
  assert,
  assertEqual,
  assertSuccess,
  assertFail
};
