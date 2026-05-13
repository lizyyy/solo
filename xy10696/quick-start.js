const { execSync } = require('child_process');

console.log('🚀 开始快速启动景区讲解器租借赔付管理系统\n');

try {
  console.log('📦 1. 安装后端依赖...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('\n📦 2. 安装前端依赖...');
  execSync('cd client && npm install', { stdio: 'inherit' });

  console.log('\n🗄️  3. 初始化数据库...');
  execSync('npm run init-db', { stdio: 'inherit' });

  console.log('\n📝 4. 导入样例数据...');
  execSync('npm run seed', { stdio: 'inherit' });

  console.log('\n✅ 初始化完成！');
  console.log('\n📋 下一步操作：');
  console.log('   运行 npm run dev 启动前后端服务');
  console.log('   访问 http://localhost:3000 打开前端');
  console.log('   后端API运行在 http://localhost:3001');
} catch (error) {
  console.error('\n❌ 初始化过程中出现错误:', error.message);
  process.exit(1);
}
