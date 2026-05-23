const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('═══════════════════════════════════════════════════');
console.log('     校车临时改线API - 安装初始化');
console.log('═══════════════════════════════════════════════════\n');

const nodeModulesDir = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesDir)) {
  console.log('📦 正在安装依赖...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('✓ 依赖安装完成\n');
  } catch (error) {
    console.log('⚠ 依赖安装可能不完整，请手动执行 npm install\n');
  }
} else {
  console.log('✓ node_modules 已存在，跳过安装\n');
}

console.log('🗄️  正在初始化数据库...');
try {
  require('./scripts/init-db');
  console.log('✓ 数据库表初始化完成\n');
} catch (error) {
  console.log('⚠ 数据库初始化可能有问题:', error.message, '\n');
}

console.log('🌱 正在导入样例数据...');
try {
  require('./scripts/seed-data');
  console.log('✓ 样例数据导入完成\n');
} catch (error) {
  console.log('⚠ 样例数据导入可能有问题:', error.message, '\n');
}

console.log('🧪 正在运行自检测试...\n');
try {
  require('./test/self-check');
} catch (error) {
  console.log('⚠ 自检测试运行出错:', error.message, '\n');
}

console.log('\n═══════════════════════════════════════════════════');
console.log('🎉 初始化完成！');
console.log('');
console.log('启动服务命令: npm start');
console.log('运行测试命令: npm test');
console.log('服务地址: http://localhost:3000');
console.log('═══════════════════════════════════════════════════\n');
