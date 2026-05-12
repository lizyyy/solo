const { Command } = require('commander');
const { isInitialized, readData, writeData } = require('../utils/storage');
const { createHazard } = require('../core/hazardService');
const { createTeam } = require('../core/teamService');
const { updateHazardStatus } = require('../core/hazardService');
const { HAZARD_STATUS } = require('../utils/constants');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const command = new Command('import')
  .description('导入数据（隐患、整改、复查、罚款）')
  .option('--teams <file>', '导入责任班组数据')
  .option('--hazards <file>', '导入隐患台账数据')
  .option('--type <type>', '数据类型: json (默认)')
  .action((options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    if (options.teams) {
      importTeams(options.teams);
    }

    if (options.hazards) {
      importHazards(options.hazards);
    }

    if (!options.teams && !options.hazards) {
      console.log(chalk.yellow('⚠️  请指定要导入的数据类型'));
      console.log(chalk.gray('   用法: hazard import --teams teams.json'));
      console.log(chalk.gray('   用法: hazard import --hazards hazards.json'));
    }
  });

function importTeams(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(chalk.red(`❌ 文件不存在: ${filePath}`));
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const teams = JSON.parse(content);

    if (!Array.isArray(teams)) {
      console.log(chalk.red('❌ 数据格式错误，应为数组'));
      return;
    }

    let successCount = 0;
    let duplicateCount = 0;

    for (const teamData of teams) {
      const result = createTeam(teamData);
      if (result.success) {
        successCount++;
        console.log(chalk.green(`✅ 已导入班组: ${teamData.name}`));
      } else if (result.isDuplicate) {
        duplicateCount++;
        console.log(chalk.yellow(`⚠️  班组已存在: ${teamData.name}（幂等跳过）`));
      } else {
        console.log(chalk.red(`❌ 导入失败: ${teamData.name} - ${result.message}`));
      }
    }

    console.log(chalk.cyan(`\n📊 导入完成: 成功 ${successCount} 条, 跳过 ${duplicateCount} 条（已存在）`));
  } catch (error) {
    console.log(chalk.red(`❌ 导入失败: ${error.message}`));
  }
}

function importHazards(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(chalk.red(`❌ 文件不存在: ${filePath}`));
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const hazards = JSON.parse(content);

    if (!Array.isArray(hazards)) {
      console.log(chalk.red('❌ 数据格式错误，应为数组'));
      return;
    }

    let successCount = 0;
    let duplicateCount = 0;

    for (const hazardData of hazards) {
      const result = createHazard(hazardData);
      if (result.success) {
        successCount++;
        console.log(chalk.green(`✅ 已导入隐患: ${result.hazard.id}`));
      } else if (result.isDuplicate) {
        duplicateCount++;
        console.log(chalk.yellow(`⚠️  检测到重复隐患: ${hazardData.description.substring(0, 20)}...（幂等跳过）`));
      } else {
        console.log(chalk.red(`❌ 导入失败: ${result.message}`));
      }
    }

    console.log(chalk.cyan(`\n📊 导入完成: 成功 ${successCount} 条, 跳过 ${duplicateCount} 条（重复）`));
  } catch (error) {
    console.log(chalk.red(`❌ 导入失败: ${error.message}`));
  }
}

module.exports = command;
