#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const PhotoMerge = require('./PhotoMerge');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('photo-merge')
  .description(packageJson.description)
  .version(packageJson.version)
  .option('-c, --config <path>', '配置文件路径', 'config/default.json')
  .option('--preview', '预览模式：只显示计划动作，不实际执行')
  .option('--run', '正式模式：执行合并操作')
  .action(async (options) => {
    try {
      if (!options.preview && !options.run) {
        console.log(chalk.yellow('⚠️  请指定运行模式：'));
        console.log(chalk.cyan('   --preview  预览模式：查看计划动作'));
        console.log(chalk.cyan('   --run      正式模式：执行合并操作'));
        console.log();
        console.log(chalk.gray('推荐先运行: npm run sample 预览样例效果'));
        process.exit(1);
      }

      const configPath = path.resolve(options.config);
      if (!fs.existsSync(configPath)) {
        console.error(chalk.red(`❌  配置文件不存在: ${configPath}`));
        process.exit(1);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const merger = new PhotoMerge(config, {
        preview: options.preview,
        configPath: configPath
      });

      if (options.preview) {
        console.log(chalk.blue.bold('\n📋 【预览模式】仅显示计划动作，不会实际修改文件\n'));
        await merger.preview();
      } else {
        console.log(chalk.magenta.bold('\n🚀 【正式模式】将执行实际的合并操作\n'));
        const confirmed = await merger.confirmAction();
        if (confirmed) {
          await merger.run();
        } else {
          console.log(chalk.yellow('\n⏹️  操作已取消'));
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌  执行失败:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program.parse(process.argv);
