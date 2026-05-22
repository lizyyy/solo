const { execSync } = require('child_process');
const path = require('path');

console.log('========================================');
console.log('冷链中转验收 - 依赖安装和验收测试');
console.log('========================================\n');

const projectRoot = __dirname;

try {
  console.log('📦 检查 node_modules...');
  const nodeModulesPath = path.join(projectRoot, 'node_modules');
  const fs = require('fs');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('   正在安装依赖...');
    execSync('npm install --no-audit --no-fund', { 
      cwd: projectRoot, 
      stdio: 'inherit',
      timeout: 120000
    });
    console.log('   ✓ 依赖安装完成');
  } else {
    console.log('   ✓ 依赖已存在');
  }

  console.log('\n🚀 开始运行验收测试...\n');
  require('./scripts/acceptance.js');
  
} catch (error) {
  console.error('\n❌ 执行失败:', error.message);
  process.exit(1);
}
