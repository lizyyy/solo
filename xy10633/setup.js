const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== 租户水电分摊账单系统 - 初始化开始 ===\n');

try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
    console.log('✓ 创建 data 目录');
  }

  console.log('\n1. 安装依赖...');
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  
  console.log('\n2. 初始化数据库...');
  execSync('npm run init-db', { stdio: 'inherit', cwd: __dirname });
  
  console.log('\n3. 插入演示数据...');
  execSync('npm run sample-data', { stdio: 'inherit', cwd: __dirname });
  
  console.log('\n=== 初始化完成！===');
  console.log('\n启动服务命令: npm start');
  console.log('访问地址: http://localhost:3000');
  
} catch (error) {
  console.error('\n❌ 初始化失败:', error.message);
  process.exit(1);
}
