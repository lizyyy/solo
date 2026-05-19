const { spawn } = require('child_process');
const path = require('path');

console.log('=== 运行农机合作社财务管理系统测试 ===\n');

const testProcess = spawn('node', [path.join(__dirname, 'test_flow.js')], {
  cwd: path.join(__dirname, '..'),
  env: process.env
});

testProcess.stdout.on('data', (data) => {
  process.stdout.write(data);
});

testProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✓ 所有测试通过！');
  } else {
    console.log(`\n✗ 测试失败，退出码: ${code}`);
  }
});
