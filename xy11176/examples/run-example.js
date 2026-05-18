#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('========================================');
console.log('  摄影器材租赁店租金结算 - 示例运行');
console.log('========================================\n');

const exampleFile = path.join(__dirname, '租赁订单-202405.csv');

console.log('正在运行示例结算...');
console.log(`数据文件: ${exampleFile}\n`);

try {
  execSync(`node ${path.join(__dirname, '..', 'bin', 'rental-settle.js')} calculate ${exampleFile}`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.log('\n示例运行完成（包含预期的数据异常用于演示）');
}

console.log('\n' + '='.repeat(50));
console.log('  说明:');
console.log('  - 上述数据异常是故意设置的示例');
console.log('  - 运营同事可按照【修复建议】修改原始数据');
console.log('  - 修改后重新运行命令即可获得正确结果');
console.log('  - 支持多次复跑，每次运行都会重新计算');
console.log('='.repeat(50));
