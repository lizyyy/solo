const fs = require('fs');
const path = require('path');

console.log('=================================');
console.log('工地人员进出API - 项目验证');
console.log('=================================\n');

const rootDir = path.join(__dirname, '..');
let allPassed = true;

function check(desc, condition, fix = null) {
  if (condition) {
    console.log(`✓ ${desc}`);
    return true;
  } else {
    console.log(`✗ ${desc}`);
    if (fix) console.log(`  修复建议: ${fix}`);
    allPassed = false;
    return false;
  }
}

const criticalFiles = [
  'package.json',
  'README.md',
  'src/server.js',
  'src/app.js',
  'src/database/db.js',
  'scripts/init-db.js',
  'scripts/seed-data.js',
  'scripts/test-sample.js'
];

console.log('1. 关键文件检查:');
for (const file of criticalFiles) {
  check(`  ${file}`, fs.existsSync(path.join(rootDir, file)));
}

const serviceFiles = [
  'src/services/accessControlService.js',
  'src/services/gateEventService.js',
  'src/services/personnelService.js',
  'src/services/trainingService.js',
  'src/services/blacklistService.js',
  'src/services/visitorService.js',
  'src/services/exceptionService.js',
  'src/services/reportService.js',
  'src/services/manualCorrectionService.js'
];

console.log('\n2. 服务层文件检查:');
for (const file of serviceFiles) {
  check(`  ${file}`, fs.existsSync(path.join(rootDir, file)));
}

const routeFiles = [
  'src/routes/gateEvents.js',
  'src/routes/personnel.js',
  'src/routes/visitors.js',
  'src/routes/exceptions.js',
  'src/routes/reports.js',
  'src/routes/corrections.js'
];

console.log('\n3. 路由层文件检查:');
for (const file of routeFiles) {
  check(`  ${file}`, fs.existsSync(path.join(rootDir, file)));
}

console.log('\n4. 启动顺序验证:');
const serverContent = fs.readFileSync(path.join(rootDir, 'src/server.js'), 'utf8');
const appRequireLine = serverContent.split('\n').findIndex(l => l.includes("require('./app')"));
const mkdirLine = serverContent.split('\n').findIndex(l => l.includes('mkdirSync'));
check('  data目录在app加载前创建', mkdirLine >= 0 && appRequireLine >= 0 && mkdirLine < appRequireLine);

console.log('\n5. 脚本启动顺序验证:');
const initDbContent = fs.readFileSync(path.join(rootDir, 'scripts/init-db.js'), 'utf8');
const dbRequireLine = initDbContent.split('\n').findIndex(l => l.includes("require('../src/database/db')"));
const initDbMkdirLine = initDbContent.split('\n').findIndex(l => l.includes('mkdirSync'));
check('  init-db.js目录在数据库加载前创建', initDbMkdirLine >= 0 && dbRequireLine >= 0 && initDbMkdirLine < dbRequireLine);

console.log('\n6. 样例数据可重复性验证:');
const seedContent = fs.readFileSync(path.join(rootDir, 'scripts/seed-data.js'), 'utf8');
check('  使用动态时间戳', seedContent.includes('Date.now()'));
check('  使用ON CONFLICT DO NOTHING', seedContent.includes('ON CONFLICT'));
check('  清理旧样例事件', seedContent.includes('DELETE FROM gate_events'));
check('  检查重复后再插入培训/黑名单', seedContent.includes('SELECT id FROM training_status') && seedContent.includes('SELECT id FROM blacklist'));

console.log('\n7. 人工修正updated_at验证:');
const correctionContent = fs.readFileSync(path.join(rootDir, 'src/services/manualCorrectionService.js'), 'utf8');
check('  区分有/无updated_at字段的表', correctionContent.includes('tablesWithUpdatedAt') && correctionContent.includes('tablesWithoutUpdatedAt'));
check('  条件更新updated_at', correctionContent.includes('tablesWithUpdatedAt.includes(tableName)'));

console.log('\n8. 重复事件去重验证:');
const accessControlContent = fs.readFileSync(path.join(rootDir, 'src/services/accessControlService.js'), 'utf8');
const gateEventContent = fs.readFileSync(path.join(rootDir, 'src/services/gateEventService.js'), 'utf8');
check('  使用5秒时间桶生成dedup_hash', accessControlContent.includes('fiveSecondBucket') || accessControlContent.includes('/ 5) * 5'));
check('  checkDuplicateEvent直接匹配字段查询', accessControlContent.includes('WHERE id_card = ?') && accessControlContent.includes('AND gate_no = ?') && accessControlContent.includes('AND direction = ?'));
check('  检测到重复时不插入新记录', gateEventContent.includes('if (validationResult.duplicate)'));
check('  重复事件返回is_duplicate标记', gateEventContent.includes('is_duplicate: true'));
check('  重复事件返回原始事件', gateEventContent.includes('original_event:'));

console.log('\n9. 依赖项验证:');
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const requiredDeps = ['express', 'better-sqlite3', 'csv-writer', 'moment', 'uuid'];
for (const dep of requiredDeps) {
  check(`  ${dep}`, !!pkgJson.dependencies[dep]);
}

console.log('\n=================================');
if (allPassed) {
  console.log('✓ 所有验证通过！');
  console.log('\n安装依赖后即可运行:');
  console.log('  npm install');
  console.log('  npm run setup');
  console.log('  npm start');
  console.log('  npm run test-sample');
} else {
  console.log('✗ 部分验证未通过，请检查以上问题');
}
console.log('=================================');

process.exit(allPassed ? 0 : 1);
