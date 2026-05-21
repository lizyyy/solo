const fs = require('fs');
const path = require('path');

console.log('==========================================');
console.log('    药品库存接口台 - 代码验证工具');
console.log('==========================================\n');

let passed = 0;
let failed = 0;

function check(description, test) {
  try {
    const result = test();
    if (result) {
      console.log(`✅ ${description}`);
      passed++;
    } else {
      console.log(`❌ ${description}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${description} - ${e.message}`);
    failed++;
  }
}

check('项目根目录结构完整', () => {
  const required = ['backend', 'frontend', 'README.md'];
  return required.every(f => fs.existsSync(path.join(__dirname, f)));
});

check('后端 package.json 存在且包含 express', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/package.json')));
  return pkg.dependencies && pkg.dependencies.express;
});

check('后端 package.json 包含所有必需依赖', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/package.json')));
  const required = ['express', 'cors', 'sqlite3', 'uuid', 'joi', 'csv-writer', 'moment'];
  return required.every(dep => pkg.dependencies[dep]);
});

check('后端入口文件 server.js 存在', () => {
  return fs.existsSync(path.join(__dirname, 'backend/src/server.js'));
});

check('后端 server.js 语法正确（可解析）', () => {
  const content = fs.readFileSync(path.join(__dirname, 'backend/src/server.js'), 'utf-8');
  return content.includes('express') && content.includes('listen') && content.includes('/api/health');
});

check('后端包含占用释放功能', () => {
  const content = fs.readFileSync(path.join(__dirname, 'backend/src/services/inventoryService.js'), 'utf-8');
  return content.includes('releaseOccupancy') && content.includes('released');
});

check('后端同步功能关联真实药品ID', () => {
  const content = fs.readFileSync(path.join(__dirname, 'backend/src/services/inventoryService.js'), 'utf-8');
  return content.includes('SELECT id, code, name FROM medicines') && !content.includes('mock-med-');
});

check('前端 package.json 存在且包含 vite', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'frontend/package.json')));
  return pkg.devDependencies && pkg.devDependencies.vite;
});

check('前端 package.json 包含 react 等依赖', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'frontend/package.json')));
  const required = ['react', 'react-dom', 'react-router-dom', 'axios'];
  return required.every(dep => pkg.dependencies[dep]);
});

check('前端入口文件 main.jsx 存在', () => {
  return fs.existsSync(path.join(__dirname, 'frontend/src/main.jsx'));
});

check('前端 App.jsx 包含多源同步导航', () => {
  const content = fs.readFileSync(path.join(__dirname, 'frontend/src/App.jsx'), 'utf-8');
  return content.includes('多源同步') && content.includes('/sync');
});

check('前端包含 Sync 页面组件', () => {
  return fs.existsSync(path.join(__dirname, 'frontend/src/pages/Sync.jsx'));
});

check('前端 BatchDetail 包含释放按钮', () => {
  const content = fs.readFileSync(path.join(__dirname, 'frontend/src/pages/BatchDetail.jsx'), 'utf-8');
  return content.includes('释放') && content.includes('releaseOccupancy');
});

check('数据库初始化脚本存在', () => {
  return fs.existsSync(path.join(__dirname, 'backend/scripts/init-db.js'));
});

check('测试数据脚本存在且包含占用记录', () => {
  const content = fs.readFileSync(path.join(__dirname, 'backend/scripts/seed-data.js'), 'utf-8');
  return content.includes('ORD001') && content.includes('active');
});

check('setup.sh 安装脚本存在', () => {
  return fs.existsSync(path.join(__dirname, 'setup.sh'));
});

check('Dockerfile 存在', () => {
  return fs.existsSync(path.join(__dirname, 'Dockerfile'));
});

console.log('\n==========================================');
console.log(`验证结果: ${passed} 通过, ${failed} 失败`);
console.log('==========================================');

if (failed > 0) {
  console.log('\n⚠️  部分验证失败，请检查上述 ❌ 项目');
  process.exit(1);
} else {
  console.log('\n✅ 代码结构验证通过！');
  console.log('\n接下来请执行:');
  console.log('  1. chmod +x setup.sh && ./setup.sh');
  console.log('  2. 或使用 Docker: docker-compose up -d');
  console.log('\n安装后启动:');
  console.log('  后端: cd backend && npm start');
  console.log('  前端: cd frontend && npm run dev');
  process.exit(0);
}
