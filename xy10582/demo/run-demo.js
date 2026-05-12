'use strict';

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const createSamplePhotos = require('./create-sample-photos');
const commands = require('../src/commands');
const { DIRS } = require('../src/utils/constants');

const sampleDataDir = path.join(__dirname, '..', 'sample-data');

function banner(text) {
  console.log('\n' + '='.repeat(60));
  console.log(chalk.bold(text));
  console.log('='.repeat(60) + '\n');
}

function section(text) {
  console.log('\n' + chalk.bold.underline(text) + '\n');
}

async function runDemo() {
  const workspace = process.cwd();
  
  banner('巡检照片重命名 CLI 演示');
  
  console.log(chalk.gray('工作区: ') + workspace);
  console.log(chalk.gray('步骤: init → import points → import records → create photos → import photos → check → archive → report'));
  
  section('步骤 1: 初始化工作区');
  await commands.init(workspace, true);
  
  section('步骤 2: 导入点位清单');
  const pointsFile = path.join(sampleDataDir, 'points.json');
  console.log(`源文件: ${pointsFile}`);
  await commands.import(workspace, 'points', pointsFile, true);
  
  section('步骤 3: 导入巡检记录');
  const recordsFile = path.join(sampleDataDir, 'records.json');
  console.log(`源文件: ${recordsFile}`);
  await commands.import(workspace, 'records', recordsFile, true);
  
  section('步骤 4: 创建样例照片');
  const rawPhotosDir = path.join(workspace, DIRS.RAW_PHOTOS);
  await createSamplePhotos(rawPhotosDir);
  
  section('步骤 5: 导入照片（扫描 raw_photos 目录）');
  await commands.import(workspace, 'photos', null, true);
  
  section('步骤 6: 检查数据并预览');
  await commands.check(workspace, false);
  
  section('步骤 7: 查看点位详情');
  console.log('查看 F1-001 点位:');
  await commands.detail(workspace, 'point', 'F1-001');
  
  section('步骤 8: 执行归档 (试运行)');
  await commands.archive(workspace, true, true);
  
  section('步骤 9: 生成报告');
  const reportFile = path.join(workspace, DIRS.REPORTS, 'demo-report.txt');
  await commands.report(workspace, 'text', reportFile);
  console.log(`\n报告已保存: ${reportFile}`);
  
  const jsonReportFile = path.join(workspace, DIRS.REPORTS, 'demo-report.json');
  await commands.report(workspace, 'json', jsonReportFile);
  console.log(`JSON 报告已保存: ${jsonReportFile}`);
  
  section('步骤 10: 模拟人工修正 (失败路径演示)');
  console.log(chalk.red('尝试修正不存在的照片:'));
  try {
    await commands.fix(workspace, 'NONEXISTENT.jpg', 'POINT-F1-001', '裂缝', '演示用户', '测试修正');
  } catch (e) {
    console.log(chalk.red('预期错误: ') + e.message);
  }
  
  console.log('\n' + chalk.green('✓ 尝试修正不存在的点位:'));
  try {
    const photos = require('../src/data/store');
    const photoList = await photos.readPhotos(workspace);
    const firstPhoto = photoList[0];
    await commands.fix(workspace, firstPhoto.id, 'POINT-INVALID', null, '演示用户', '测试无效点位');
  } catch (e) {
    console.log(chalk.red('预期错误: ') + e.message);
  }
  
  section('查看操作历史');
  await commands.detail(workspace, 'history', null);
  
  banner('演示完成！');
  console.log(chalk.green('\n主要演示路径:'));
  console.log('  1. init - 初始化工作区');
  console.log('  2. import points - 导入点位清单');
  console.log('  3. import records - 导入巡检记录');
  console.log('  4. import photos - 扫描照片目录');
  console.log('  5. check - 检查并预览重命名');
  console.log('  6. archive - 执行归档');
  console.log('  7. report - 生成报告');
  
  console.log(chalk.yellow('\n失败路径演示:'));
  console.log('  1. 修正不存在的照片 → 报错');
  console.log('  2. 修正使用不存在的点位 → 报错');
  console.log('  3. 照片无对应记录 → NO_POINT 状态');
  console.log('  4. 照片内容重复 → DUPLICATE 状态');
  
  console.log(chalk.gray('\n生成的文件位置:'));
  console.log(`  数据目录: .inspection/`);
  console.log(`  报告目录: reports/`);
  console.log(`  样例照片: raw_photos/`);
}

runDemo().catch(err => {
  console.error('\n' + chalk.red('演示失败:') + ' ' + err.message);
  console.error(err.stack);
  process.exit(1);
});
