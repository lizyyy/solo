// 简单测试脚本 - 验证代码逻辑
const fs = require('fs');
const path = require('path');

console.log('=== 简单测试脚本 ===');
console.log('当前目录:', process.cwd());
console.log('Node版本:', process.version);

// 检查测试数据文件
console.log('\n=== 检查测试数据文件 ===');
const testFiles = [
  'test_data/vehicles.csv',
  'test_data/fuel.csv', 
  'test_data/mileage.csv',
  'test_data/drivers.csv',
  'test_data/routes.csv'
];

testFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${file}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
});

// 检查脏数据文件
console.log('\n=== 检查脏数据文件 ===');
const dirtyFiles = [
  'test_data_dirty/vehicles.csv',
  'test_data_dirty/fuel.csv',
  'test_data_dirty/mileage.csv',
  'test_data_dirty/drivers.csv',
  'test_data_dirty/routes.csv'
];

dirtyFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${file}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
});

console.log('\n=== 测试完成 ===');
