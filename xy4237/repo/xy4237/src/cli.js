#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');

const SceneChecker = require('./index');
const Scanner = require('./scanner');
const Parser = require('./parser');
const RuleEngine = require('./rules');
const Storage = require('./storage');
const Exporter = require('./exporter');

program
  .name('scene-check')
  .description('换景清单巡检员 - 剧院舞台监督自动化工具')
  .version('1.0.0', '-v, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息');

program
  .command('scan <directory>')
  .description('扫描演出目录并列出所有文件')
  .option('-v, --verbose', '显示详细信息')
  .action(async (directory, options) => {
    try {
      console.log(chalk.blue('🔍 开始扫描目录:'), directory);
      
      const scanner = new Scanner();
      const files = await scanner.scan(directory);
      
      console.log('\n' + '='.repeat(60));
      console.log(chalk.bold('📁 文件列表'));
      console.log('='.repeat(60));
      
      if (files.length === 0) {
        console.log(chalk.yellow('未找到任何有效文件'));
        return;
      }
      
      const categories = {
        props: [],
        lighting: [],
        actors: [],
        notes: [],
        unknown: []
      };
      
      files.forEach(file => {
        const cat = categories[file.category] || categories.unknown;
        cat.push(file);
      });
      
      const categoryLabels = {
        props: '📦 道具清单',
        lighting: '💡 灯光Cue',
        actors: '🎭 演员出入场',
        notes: '📝 临时备注',
        unknown: '❓ 未分类'
      };
      
      for (const [cat, catFiles] of Object.entries(categories)) {
        if (catFiles.length > 0) {
          console.log(`\n${categoryLabels[cat]} (${catFiles.length}个):`);
          catFiles.forEach(file => {
            const size = (file.size / 1024).toFixed(2);
            console.log(`  ${chalk.gray('•')} ${file.name} ${chalk.dim(`(${size} KB)`)}`);
            if (options.verbose) {
              console.log(`    路径: ${file.path}`);
              console.log(`    修改时间: ${file.modified}`);
            }
          });
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log(chalk.green(`总计: ${files.length} 个文件`));
      
    } catch (error) {
      console.error(chalk.red('❌ 扫描失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('check <directory>')
  .description('执行完整的换景巡检流程')
  .option('-e, --export', '导出巡检报告')
  .option('-o, --output <path>', '输出目录', './output')
  .option('-f, --format <formats>', '导出格式 (md,csv,json)', 'md,csv,json')
  .option('-t, --time-limit <seconds>', '换景时间阈值(秒)', '120')
  .option('--no-confirm-check', '跳过确认状态检查')
  .option('-v, --verbose', '显示详细信息')
  .action(async (directory, options) => {
    try {
      console.log(chalk.blue('\n🎭 换景清单巡检员 v1.0.0'));
      console.log(chalk.blue('='.repeat(50)));
      
      const checker = new SceneChecker({
        outputDir: options.output
      });
      
      const result = await checker.run(directory, {
        export: options.export,
        exportFormats: options.format.split(','),
        timeLimit: parseInt(options.timeLimit),
        skipConfirmCheck: !options.confirmCheck
      });
      
      if (options.verbose && result.tasks.length > 0) {
        console.log('\n' + '='.repeat(50));
        console.log(chalk.bold('📋 任务详情'));
        console.log('='.repeat(50));
        
        result.tasks.forEach((task, index) => {
          const status = task.confirmed ? chalk.green('✅') : chalk.yellow('⏳');
          const priority = {
            high: chalk.red('🔴 高'),
            medium: chalk.yellow('🟡 中'),
            low: chalk.green('🟢 低')
          }[task.priority] || '🟡 中';
          
          const dangerous = task.isDangerous ? chalk.red(' ⚠️危险') : '';
          
          console.log(`\n${index + 1}. ${status} ${task.name}${dangerous}`);
          console.log(`   类型: ${task.type} | 优先级: ${priority}`);
          console.log(`   场景: ${task.scene || '未指定'} | Cue: ${task.cue || '未指定'}`);
          console.log(`   负责人: ${task.responsible || '未指定'}`);
          if (task.time) {
            console.log(`   预计时间: ${task.time} 秒`);
          }
          if (task.confirmation) {
            console.log(`   确认人: ${task.confirmation.inspector}`);
            console.log(`   确认时间: ${task.confirmation.timestamp}`);
          }
        });
      }
      
      if (!result.success) {
        console.log('\n' + chalk.red('⚠️  检测到问题，请查看上面的报告'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ 巡检失败:'), error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('confirm <taskId> <inspector>')
  .description('确认一个任务已完成')
  .option('-n, --notes <text>', '备注信息')
  .option('-d, --directory <path>', '演出目录路径')
  .action(async (taskId, inspector, options) => {
    try {
      const storage = new Storage();
      
      const confirmation = await storage.saveConfirmation({
        taskId,
        inspector,
        notes: options.notes,
        showDirectory: options.directory,
        timestamp: new Date().toISOString()
      });
      
      console.log(chalk.green('✅ 任务已确认'));
      console.log(`   任务ID: ${confirmation.taskId}`);
      console.log(`   确认人: ${confirmation.inspector}`);
      console.log(`   时间: ${confirmation.updatedAt}`);
      
      if (confirmation.notes) {
        console.log(`   备注: ${confirmation.notes}`);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ 确认失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查看巡检历史记录')
  .option('-n, --limit <number>', '显示最近N条记录', '10')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options) => {
    try {
      const storage = new Storage();
      const history = await storage.loadHistory(parseInt(options.limit));
      
      console.log('\n' + '='.repeat(60));
      console.log(chalk.bold('📜 巡检历史记录'));
      console.log('='.repeat(60));
      
      if (history.length === 0) {
        console.log(chalk.yellow('暂无历史记录'));
        return;
      }
      
      history.forEach((entry, index) => {
        const status = entry.success ? chalk.green('✅ 成功') : chalk.red('❌ 失败');
        console.log(`\n${index + 1}. ${status}`);
        console.log(`   时间: ${entry.timestamp}`);
        console.log(`   目录: ${entry.showDirectory}`);
        
        if (entry.stats) {
          console.log(`   任务: ${entry.stats.totalTasks} 个`);
          console.log(`   已确认: ${entry.stats.confirmed} 个`);
          console.log(`   问题: ${entry.stats.issues} 个`);
          console.log(`   警告: ${entry.stats.warnings} 个`);
        }
        
        if (options.verbose && entry.tasks) {
          console.log('\n   任务列表:');
          entry.tasks.forEach(task => {
            const confirmed = task.confirmed ? '✅' : '⏳';
            const dangerous = task.isDangerous ? '⚠️' : '';
            console.log(`     ${confirmed} ${task.name} ${dangerous}`);
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('❌ 获取历史记录失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('export <directory>')
  .description('单独导出巡检报告')
  .option('-o, --output <path>', '输出目录', './output')
  .option('-f, --format <formats>', '导出格式 (md,csv,json)', 'md,csv,json')
  .action(async (directory, options) => {
    try {
      console.log(chalk.blue('📤 准备导出...'));
      
      const checker = new SceneChecker({
        outputDir: options.output
      });
      
      const result = await checker.run(directory, {
        export: true,
        exportFormats: options.format.split(',')
      });
      
      if (result.exportPaths) {
        console.log('\n' + chalk.green('✅ 导出成功!'));
        Object.entries(result.exportPaths).forEach(([format, path]) => {
          console.log(`   ${format}: ${path}`);
        });
      }
      
    } catch (error) {
      console.error(chalk.red('❌ 导出失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('clear')
  .description('清除确认记录和历史')
  .option('-d, --directory <path>', '指定演出目录(不指定则清除全部)')
  .option('-y, --yes', '确认清除(无需交互)')
  .action(async (options) => {
    const readline = require('readline');
    
    if (!options.yes) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question(chalk.yellow(`⚠️  确定要清除${options.directory ? '该目录的' : '所有'}确认记录吗? (y/N) `), resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log(chalk.blue('操作已取消'));
        return;
      }
    }
    
    try {
      const storage = new Storage();
      await storage.clearConfirmations(options.directory);
      
      console.log(chalk.green('✅ 确认记录已清除'));
      
    } catch (error) {
      console.error(chalk.red('❌ 清除失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('运行演示示例')
  .option('-e, --export', '导出演示报告')
  .action(async (options) => {
    console.log(chalk.blue('\n🎭 换景清单巡检员 - 演示模式'));
    console.log(chalk.blue('='.repeat(50)));
    
    const demoDir = path.join(__dirname, '../examples/demo-show');
    
    try {
      const fs = require('fs-extra');
      if (!await fs.pathExists(demoDir)) {
        console.log(chalk.yellow('演示目录不存在，请先创建示例数据'));
        console.log('运行: npm run generate-examples 或查看 examples 目录');
        process.exit(1);
      }
      
      const checker = new SceneChecker();
      await checker.run(demoDir, {
        export: options.export
      });
      
    } catch (error) {
      console.error(chalk.red('❌ 演示运行失败:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
