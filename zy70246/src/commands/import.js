const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const DataStore = require('../stores/DataStore');

function importToilets(filePath, options) {
  const store = new DataStore(options.dataDir || './data');
  const sourceName = options.source || path.basename(filePath, '.json');

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`错误: 文件不存在 - ${filePath}`));
    process.exit(1);
  }

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(chalk.red(`错误: JSON 解析失败 - ${e.message}`));
    process.exit(1);
  }

  const results = store.importToilets(rawData, sourceName);

  console.log(chalk.bold.cyan('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│              公厕点位导入结果                │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘\n'));

  console.log(chalk.bold('📊 导入统计:'));
  const statsTable = new Table({
    head: [chalk.gray('指标'), chalk.gray('数量')],
    colWidths: [20, 15]
  });
  statsTable.push(
    [chalk.white('总数'), chalk.white(results.total)],
    [chalk.green('新增'), chalk.green(results.added)],
    [chalk.yellow('更新'), chalk.yellow(results.updated)],
    [chalk.magenta('重复'), chalk.magenta(results.duplicates.length)],
    [chalk.red('无效'), chalk.red(results.invalid.length)],
    [chalk.yellow('预警'), chalk.yellow(results.warnings.length)]
  );
  console.log(statsTable.toString());

  if (results.duplicates.length > 0) {
    console.log('\n' + chalk.magenta.bold('⚠️  重复数据检测 (' + results.duplicates.length + ' 条):'));
    const dupTable = new Table({
      head: [chalk.gray('编号'), chalk.gray('名称'), chalk.gray('已有来源'), chalk.gray('新来源')],
      colWidths: [12, 20, 20, 20]
    });
    results.duplicates.forEach(d => {
      dupTable.push([d.id, d.name, d.existingSource, d.newSource]);
    });
    console.log(dupTable.toString());
  }

  if (results.invalid.length > 0) {
    console.log('\n' + chalk.red.bold('❌ 无效数据 (' + results.invalid.length + ' 条):'));
    results.invalid.forEach((inv, idx) => {
      console.log(chalk.red(`\n  ${idx + 1}. 数据: ${JSON.stringify(inv.data).substring(0, 80)}...`));
      inv.errors.forEach(e => {
        console.log(chalk.red(`     - ${e.message}`));
      });
    });
  }

  if (results.warnings.length > 0) {
    console.log('\n' + chalk.yellow.bold('⚠️  业务预警 (' + results.warnings.length + ' 条):'));
    results.warnings.forEach((w, idx) => {
      console.log(chalk.yellow(`\n  ${idx + 1}. [${w.id}] ${w.name}`));
      w.warnings.forEach(wn => {
        console.log(chalk.yellow(`     - ${wn.message}`));
      });
    });
  }

  console.log('\n' + chalk.gray(`数据已保存至: ${options.dataDir || './data'}`));
}

function importComplaints(filePath, options) {
  const store = new DataStore(options.dataDir || './data');
  const sourceName = options.source || path.basename(filePath, '.json');

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`错误: 文件不存在 - ${filePath}`));
    process.exit(1);
  }

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(chalk.red(`错误: JSON 解析失败 - ${e.message}`));
    process.exit(1);
  }

  const results = store.importComplaints(rawData, sourceName);

  console.log(chalk.bold.cyan('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│              投诉数据导入结果                │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘\n'));

  console.log(chalk.bold('📊 导入统计:'));
  const statsTable = new Table({
    head: [chalk.gray('指标'), chalk.gray('数量')],
    colWidths: [20, 15]
  });
  statsTable.push(
    [chalk.white('总数'), chalk.white(results.total)],
    [chalk.green('新增'), chalk.green(results.added)],
    [chalk.magenta('重复'), chalk.magenta(results.duplicates.length)],
    [chalk.red('无效'), chalk.red(results.invalid.length)]
  );
  console.log(statsTable.toString());

  if (results.updatedComplaintCount.length > 0) {
    console.log('\n' + chalk.blue.bold('🔄 关联公厕投诉数已更新:'));
    const updateTable = new Table({
      head: [chalk.gray('公厕编号'), chalk.gray('公厕名称'), chalk.gray('活跃投诉数')],
      colWidths: [12, 25, 15]
    });
    results.updatedComplaintCount.forEach(u => {
      updateTable.push([u.toiletId, u.toiletName, u.newCount]);
    });
    console.log(updateTable.toString());
  }

  if (results.unlinkedToilets.length > 0) {
    console.log('\n' + chalk.yellow.bold('🔗 未关联公厕 (请检查公厕编号):'));
    results.unlinkedToilets.forEach(u => {
      console.log(chalk.yellow(`  - 投诉ID: ${u.complaintId}, 公厕编号: ${u.toiletId}, 内容: ${u.description.substring(0, 30)}...`));
    });
  }

  if (results.invalid.length > 0) {
    console.log('\n' + chalk.red.bold('❌ 无效投诉数据 (' + results.invalid.length + ' 条):'));
    results.invalid.forEach((inv, idx) => {
      console.log(chalk.red(`\n  ${idx + 1}. 数据: ${JSON.stringify(inv.data).substring(0, 80)}...`));
      inv.errors.forEach(e => {
        console.log(chalk.red(`     - ${e.message}`));
      });
    });
  }

  console.log('\n' + chalk.gray(`数据已保存至: ${options.dataDir || './data'}`));
}

module.exports = {
  importToilets,
  importComplaints
};
