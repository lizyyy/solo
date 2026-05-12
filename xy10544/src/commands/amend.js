const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { amendHazard } = require('../core/amendmentService');
const { getHazardById } = require('../utils/helpers');
const chalk = require('chalk');

const command = new Command('amend')
  .description('人工修正隐患信息（记录差异和操作者）')
  .argument('<hazardId>', '隐患ID')
  .option('--location <location>', '修正位置')
  .option('--description <text>', '修正描述')
  .option('--level <level>', '修正等级: minor|general|major|critical')
  .option('--team <teamId>', '修正责任班组')
  .option('-o, --operator <name>', '操作人')
  .action((hazardId, options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    const hazard = getHazardById(hazardId);
    if (!hazard) {
      console.log(chalk.red(`❌ 隐患不存在: ${hazardId}`));
      return;
    }

    const updates = {};
    if (options.location) updates.location = options.location;
    if (options.description) updates.description = options.description;
    if (options.level) updates.level = options.level;
    if (options.team) updates.responsibleTeamId = options.team;

    if (Object.keys(updates).length === 0) {
      console.log(chalk.yellow('⚠️  未指定任何修正字段'));
      console.log(chalk.gray('   可用选项: --location, --description, --level, --team'));
      return;
    }

    const result = amendHazard(hazardId, updates, options.operator);

    if (result.success) {
      console.log(chalk.green('✅ 隐患信息修正成功！'));
      console.log(chalk.cyan(`   操作人: ${options.operator || 'system'}`));
      console.log(chalk.cyan(`\n   变更记录:`));
      
      for (const [key, diff] of Object.entries(result.changes)) {
        console.log(chalk.gray(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
        console.log(chalk.yellow(`   字段: ${key}`));
        console.log(chalk.red(`   修改前: ${JSON.stringify(diff.old)}`));
        console.log(chalk.green(`   修改后: ${JSON.stringify(diff.new)}`));
      }
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

module.exports = command;
