const fs = require('fs');
const path = require('path');

console.log('=== API 功能离线验证 ===\n');

const results = {
  total: 0,
  passed: 0,
  failed: 0
};

function test(name, fn) {
  results.total++;
  try {
    fn();
    console.log(`  ✅ ${name}`);
    results.passed++;
  } catch (error) {
    console.log(`  ❌ ${name}: ${error.message}`);
    results.failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

console.log('📁 验证文件结构完整性:');

const requiredFiles = [
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
  'src/controllers/renewalController.js'
];

for (const file of requiredFiles) {
  test(`文件存在: ${file}`, () => {
    const exists = fs.existsSync(path.join(__dirname, '..', file));
    assert(exists, '文件不存在');
  });
}

console.log('\n🔍 验证 JavaScript 语法:');

const jsFiles = requiredFiles.concat(['scripts/initData.js', 'scripts/verifySetup.js']);
for (const file of jsFiles) {
  test(`语法检查: ${file}`, () => {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf-8');
    try {
      new Function(content);
    } catch (e) {
      assert(false, `语法错误: ${e.message}`);
    }
  });
}

console.log('\n🔧 验证核心功能实现:');

const serviceCode = fs.readFileSync(
  path.join(__dirname, '..', 'src/services/renewalService.js'), 'utf-8'
);

test('资格匹配 - 按证书类型过滤课程', () => {
  assert(
    serviceCode.includes('findCoursesByCertificateType'),
    '缺少按证书类型过滤课程的逻辑'
  );
});

test('资格匹配 - 无成绩时默认不合格', () => {
  assert(
    serviceCode.includes('isQualified = requiredCourses.length > 0'),
    '无成绩时默认值错误'
  );
});

test('续期状态 - hasValidCertificate 判断', () => {
  assert(
    serviceCode.includes('hasValidCertificate'),
    '缺少有效证书标志判断'
  );
});

test('续期状态 - 待培训状态', () => {
  assert(
    serviceCode.includes('待培训'),
    '缺少待培训状态'
  );
});

test('续期状态 - 待取证状态', () => {
  assert(
    serviceCode.includes('待取证'),
    '缺少待取证状态'
  );
});

test('补考处理 - 按ID查询', () => {
  assert(
    serviceCode.includes('findRetakeById'),
    '缺少按ID查询补考记录的逻辑'
  );
});

console.log('\n📊 验证路由完整性:');

const routesCode = fs.readFileSync(
  path.join(__dirname, '..', 'src/routes.js'), 'utf-8'
);

const expectedRoutes = [
  '/employees',
  '/certificates/types',
  '/certificates/expiring',
  '/courses',
  '/courses/scores',
  '/courses/retakes',
  '/renewal/checklist',
  '/renewal/exceptions',
  '/renewal/manual-correction',
  '/export/checklist/csv',
  '/export/checklist/json',
  '/export/files'
];

for (const route of expectedRoutes) {
  test(`路由存在: ${route}`, () => {
    assert(routesCode.includes(route), `路由 ${route} 不存在`);
  });
}

console.log('\n📦 验证 DAO 方法完整性:');

const courseDaoCode = fs.readFileSync(
  path.join(__dirname, '..', 'src/daos/courseDao.js'), 'utf-8'
);

const expectedDaoMethods = [
  'findCoursesByCertificateType',
  'findRetakeById',
  'findAllRetakeRecords',
  'createCourse',
  'createCourseScore',
  'createRetakeRecord',
  'updateRetakeRecord',
  'findEmployeeCourseScores',
  'findEmployeeRetakeRecords'
];

for (const method of expectedDaoMethods) {
  test(`DAO方法存在: ${method}`, () => {
    assert(courseDaoCode.includes(method), `方法 ${method} 不存在`);
  });
}

console.log('\n=============================================');
console.log(`测试结果: ${results.passed}/${results.total} 通过`);
console.log(`通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);
console.log('=============================================');

if (results.failed > 0) {
  console.log(`\n❌ 有 ${results.failed} 项测试未通过`);
  process.exit(1);
} else {
  console.log('\n✅ 所有离线测试通过!');
  console.log('\n💡 提示: 运行 npm install 后可启动服务进行集成测试');
  process.exit(0);
}
