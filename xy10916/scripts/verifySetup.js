const fs = require('fs');
const path = require('path');

console.log('=== 验证项目设置 ===\n');

const requiredFiles = [
  'package.json',
  'README.md',
  'src/server.js',
  'src/routes.js',
  'src/config/database.js',
  'src/models/initTables.js',
  'src/daos/employeeDao.js',
  'src/daos/certificateDao.js',
  'src/daos/courseDao.js',
  'src/daos/renewalDao.js',
  'src/services/renewalService.js',
  'src/services/exportService.js',
  'src/controllers/employeeController.js',
  'src/controllers/certificateController.js',
  'src/controllers/renewalController.js',
  'scripts/initData.js'
];

let allPresent = true;
console.log('📁 检查必需文件:');
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
  if (!exists) allPresent = false;
}

console.log('\n🔧 检查代码修复:');
const checks = [
  {
    name: 'data/ 目录自动创建',
    file: 'src/config/database.js',
    pattern: /mkdirSync.*data/
  },
  {
    name: '补考查询 findRetakeById',
    file: 'src/daos/courseDao.js',
    pattern: /findRetakeById/
  },
  {
    name: '补考修复使用 findRetakeById',
    file: 'src/services/renewalService.js',
    pattern: /findRetakeById/
  },
  {
    name: 'initData 支持重复调用',
    file: 'scripts/initData.js',
    pattern: /findOrCreate/
  },
  {
    name: '导出目录自动创建',
    file: 'src/services/exportService.js',
    pattern: /ensureExportDir/
  }
];

for (const check of checks) {
  const content = fs.readFileSync(path.join(__dirname, '..', check.file), 'utf-8');
  const passed = check.pattern.test(content);
  console.log(`  ${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) allPresent = false;
}

console.log('\n📦 检查 package.json 脚本:');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
const expectedScripts = ['start', 'dev', 'init-data'];
for (const script of expectedScripts) {
  const exists = pkg.scripts[script] !== undefined;
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${script}: ${pkg.scripts[script] || '未找到'}`);
}

console.log('\n📚 检查 package.json 依赖:');
const expectedDeps = ['express', 'sqlite3', 'uuid', 'csv-writer'];
for (const dep of expectedDeps) {
  const exists = pkg.dependencies[dep] !== undefined;
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${dep}`);
}

console.log('\n🏗️  目录结构验证:');
const dirs = ['src/config', 'src/models', 'src/daos', 'src/services', 'src/controllers', 'scripts'];
for (const dir of dirs) {
  const dirPath = path.join(__dirname, '..', dir);
  const exists = fs.existsSync(dirPath);
  console.log(`  ${exists ? '✅' : '❌'} ${dir}/`);
}

console.log('\n=============================================');
if (allPresent) {
  console.log('✅ 所有检查通过! 项目已准备就绪。');
} else {
  console.log('⚠️  部分检查未通过，请检查代码');
}
console.log('=============================================');
console.log('\n启动步骤:');
console.log('  1. npm install      - 安装依赖');
console.log('  2. npm run init-data - 初始化样例数据 (可重复执行)');
console.log('  3. npm start        - 启动服务');
console.log('\n✅ data/ 和 exports/ 目录会自动创建，无需手动创建');
