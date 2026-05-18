const fs = require('fs');
const path = require('path');
const { sequelize, TestDrive, AccidentRecord } = require('../src/models');
const { testDrives, normalAccidentCase, conflictCases } = require('../data/seedData');
const { createAccidentRecord } = require('../src/services/accidentService');

async function initDatabase() {
  console.log('========================================');
  console.log('汽车试驾中心试驾事故登记API - 初始化');
  console.log('========================================\n');

  const dbDir = path.join(__dirname, '..', 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✓ 创建数据库目录');
  }

  console.log('✓ 同步数据库结构...');
  await sequelize.sync({ force: true });
  console.log('✓ 数据库结构同步完成\n');

  console.log('========================================');
  console.log('导入试驾记录数据');
  console.log('========================================');
  const createdTestDrives = [];
  for (const testDrive of testDrives) {
    const td = await TestDrive.create(testDrive);
    createdTestDrives.push(td);
    console.log(`✓ 导入: ${td.testDriveNo} - ${td.customerName} - ${td.vehicleModel}`);
  }
  console.log(`共导入 ${createdTestDrives.length} 条试驾记录\n`);

  console.log('========================================');
  console.log('导入正常事故案例');
  console.log('========================================');
  const normalCase = normalAccidentCase;
  const normalResult = await createAccidentRecord({
    ...normalCase.accidentData,
    testDriveId: createdTestDrives[normalCase.testDriveIndex].id,
    operator: 'system_init'
  });
  console.log(`✓ 状态: ${normalResult.data.status}`);
  console.log(`✓ 事故编号: ${normalResult.data.accidentNo}`);
  console.log(`✓ 说明: ${normalResult.message}`);
  if (normalResult.warnings && normalResult.warnings.length > 0) {
    normalResult.warnings.forEach(w => {
      console.log(`  ⚠️  ${w.code}: ${w.message}`);
      console.log(`      建议: ${w.suggestion}`);
    });
  }
  console.log();

  console.log('========================================');
  console.log('导入异常事故案例（共' + conflictCases.length + '个）');
  console.log('========================================\n');

  for (let i = 0; i < conflictCases.length; i++) {
    const caseItem = conflictCases[i];
    console.log(`────────────────────────────────────────`);
    console.log(`案例 ${i + 1}: ${caseItem.name}`);
    console.log(`────────────────────────────────────────`);

    const result = await createAccidentRecord({
      ...caseItem.accidentData,
      testDriveId: createdTestDrives[caseItem.testDriveIndex].id,
      operator: 'system_init'
    });

    console.log(`✓ 实际状态: ${result.data.status}`);
    console.log(`✓ 预期状态: ${caseItem.expectedStatus}`);
    console.log(`✓ 状态匹配: ${result.data.status === caseItem.expectedStatus ? '✓ 正确' : '✗ 不匹配'}`);
    console.log(`✓ 事故编号: ${result.data.accidentNo}`);
    console.log(`✓ 说明: ${result.message}`);

    if (result.errors && result.errors.length > 0) {
      console.log('  错误信息:');
      result.errors.forEach(e => {
        console.log(`    ✗ ${e.code}: ${e.message}`);
        console.log(`      建议: ${e.suggestion}`);
      });
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log('  警告信息:');
      result.warnings.forEach(w => {
        console.log(`    ⚠️  ${w.code}: ${w.message}`);
        console.log(`      建议: ${w.suggestion}`);
      });
    }

    console.log();
  }

  console.log('========================================');
  console.log('初始化完成！');
  console.log('========================================');
  console.log('\n数据统计:');
  const accidentCount = await AccidentRecord.count();
  console.log(`- 试驾记录: ${createdTestDrives.length} 条`);
  console.log(`- 事故记录: ${accidentCount} 条`);

  const statusStats = await AccidentRecord.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status']
  });
  console.log('\n事故记录状态分布:');
  statusStats.forEach(stat => {
    console.log(`- ${stat.status}: ${stat.dataValues.count} 条`);
  });

  console.log('\n下一步:');
  console.log('- npm start             # 启动API服务器');
  console.log('- npm run test:normal   # 运行正常单测试');
  console.log('- npm run test:conflict # 运行冲突单测试');
  console.log('- 打开 http://localhost:3000 查看API接口文档\n');

  await sequelize.close();
}

initDatabase().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
