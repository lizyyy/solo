#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');
const Table = require('cli-table3');
const { ObstacleService } = require('./service');

function printEvidenceSummary(details) {
  console.log('\n' + chalk.bgBlue.white(' 证据摘要 '));
  console.log(chalk.cyan('障碍物备注: ') + (details.evidenceSummary.obstacleRemark || '(无)'));
  console.log(chalk.cyan('楼层剖面草图: ') + (details.evidenceSummary.floorPlanSketch || '(未关联)'));
  console.log(chalk.cyan('告警标签状态: ') + (details.evidenceSummary.alarmTagBlocked ? chalk.red('被遮挡') : chalk.green('正常')));
}

function printReport(report) {
  console.log('\n' + chalk.bgMagenta.white(' 安全距离报告 '));
  console.log(chalk.yellow(report.title));
  console.log(report.content);
  console.log('\n' + chalk.dim('报告ID: ' + report.id));
  console.log(chalk.dim('生成时间: ' + report.generatedAt));
}

yargs
  .command('import <file>', '导入障碍物数据', (yargs) => {
    yargs.positional('file', {
      describe: 'JSON数据文件路径',
      type: 'string'
    });
  }, async (argv) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const data = JSON.parse(fs.readFileSync(path.resolve(argv.file), 'utf8'));
      
      const result = ObstacleService.importObstacle(data);
      
      console.log(chalk.green('✓ 障碍物导入成功'));
      console.log(chalk.cyan('障碍物ID: ') + result.obstacle.id);
      
      if (result.obstacle.alarmTagBlocked) {
        console.log(chalk.red('⚠ 检测到告警标签被遮挡，已标记待施工经理复核'));
      }
      
      printEvidenceSummary(ObstacleService.getObstacleWithDetails(result.obstacle.id));
      printReport(result.report);
    } catch (e) {
      console.error(chalk.red('导入失败: ' + e.message));
      process.exit(1);
    }
  })
  .command('list', '列出所有障碍物', {}, () => {
    const obstacles = ObstacleService.getAllObstacles();
    
    const table = new Table({
      head: ['ID', '楼层', '位置', '状态', '告警标签', '负责人'],
      colWidths: [20, 8, 20, 25, 12, 15]
    });
    
    obstacles.forEach(o => {
      table.push([
        o.id,
        o.floor,
        o.location,
        o.status,
        o.alarmTagBlocked ? chalk.red('遮挡') : chalk.green('正常'),
        o.assignedTo || '-'
      ]);
    });
    
    console.log(table.toString());
  })
  .command('show <id>', '查看障碍物详情', (yargs) => {
    yargs.positional('id', { describe: '障碍物ID', type: 'string' });
  }, (argv) => {
    const details = ObstacleService.getObstacleWithDetails(argv.id);
    if (!details) {
      console.error(chalk.red('障碍物不存在'));
      process.exit(1);
    }
    
    console.log(chalk.bgBlue.white(' 障碍物详情 '));
    console.log(chalk.cyan('ID: ') + details.obstacle.id);
    console.log(chalk.cyan('楼层: ') + details.obstacle.floor);
    console.log(chalk.cyan('位置: ') + details.obstacle.location);
    console.log(chalk.cyan('描述: ') + details.obstacle.description);
    console.log(chalk.cyan('安全距离: ') + details.obstacle.safetyDistance + '米');
    console.log(chalk.cyan('状态: ') + details.obstacle.status);
    console.log(chalk.cyan('负责人: ') + (details.obstacle.assignedTo || '-'));
    console.log(chalk.cyan('下一步: ') + (details.obstacle.nextAction || '-'));
    
    if (details.floorPlan) {
      console.log(chalk.cyan('楼层剖面: ') + details.floorPlan.name);
    }
    
    printEvidenceSummary(details);
    
    if (details.reports.length > 0) {
      printReport(details.reports[details.reports.length - 1]);
    }
  })
  .command('manager-review <id>', '施工经理复核', (yargs) => {
    yargs
      .positional('id', { describe: '障碍物ID', type: 'string' })
      .option('approved', { alias: 'a', type: 'boolean', demandOption: true, describe: '是否通过' })
      .option('remark', { alias: 'r', type: 'string', describe: '复核备注' })
      .option('correction', { alias: 'c', type: 'string', describe: '修正说明' });
  }, (argv) => {
    try {
      const result = ObstacleService.reviewByManager(argv.id, {
        approved: argv.approved,
        remark: argv.remark,
        correctionNote: argv.correction
      });
      
      console.log(chalk.green('✓ 施工经理复核完成'));
      console.log(chalk.cyan('新状态: ') + result.obstacle.status);
      console.log(chalk.cyan('负责人: ') + result.obstacle.assignedTo);
      console.log(chalk.cyan('下一步: ') + result.obstacle.nextAction);
      
      printReport(result.report);
    } catch (e) {
      console.error(chalk.red('复核失败: ' + e.message));
      process.exit(1);
    }
  })
  .command('create-floorplan', '创建楼层剖面草图', (yargs) => {
    yargs
      .option('floor', { alias: 'f', type: 'string', demandOption: true, describe: '楼层' })
      .option('name', { alias: 'n', type: 'string', demandOption: true, describe: '名称' })
      .option('description', { alias: 'd', type: 'string', describe: '描述' });
  }, (argv) => {
    const floorPlan = ObstacleService.createFloorPlan({
      floor: argv.floor,
      name: argv.name,
      description: argv.description
    });
    
    console.log(chalk.green('✓ 楼层剖面草图创建成功'));
    console.log(chalk.cyan('ID: ') + floorPlan.id);
    console.log(chalk.cyan('楼层: ') + floorPlan.floor);
    console.log(chalk.cyan('名称: ') + floorPlan.name);
  })
  .command('attach-floorplan <obstacleId> <floorPlanId>', '关联楼层剖面草图', (yargs) => {
    yargs
      .positional('obstacleId', { describe: '障碍物ID', type: 'string' })
      .positional('floorPlanId', { describe: '楼层剖面ID', type: 'string' });
  }, (argv) => {
    try {
      const result = ObstacleService.attachFloorPlan(argv.obstacleId, argv.floorPlanId);
      
      console.log(chalk.green('✓ 楼层剖面草图关联成功'));
      console.log(chalk.cyan('障碍物: ') + result.obstacle.id);
      console.log(chalk.cyan('关联草图: ') + result.floorPlan.name);
      
      printReport(result.report);
    } catch (e) {
      console.error(chalk.red('关联失败: ' + e.message));
      process.exit(1);
    }
  })
  .command('tao-review <id>', '园区运维小陶复核', (yargs) => {
    yargs
      .positional('id', { describe: '障碍物ID', type: 'string' })
      .option('approved', { alias: 'a', type: 'boolean', demandOption: true, describe: '是否通过' })
      .option('correction', { alias: 'c', type: 'string', describe: '修正说明' });
  }, (argv) => {
    try {
      const result = ObstacleService.reviewByTao(argv.id, {
        approved: argv.approved,
        correctionNote: argv.correction
      });
      
      console.log(chalk.green('✓ 园区运维小陶复核完成'));
      console.log(chalk.cyan('新状态: ') + result.obstacle.status);
      console.log(chalk.cyan('负责人: ') + result.obstacle.assignedTo);
      console.log(chalk.cyan('下一步: ') + result.obstacle.nextAction);
      
      printReport(result.report);
    } catch (e) {
      console.error(chalk.red('复核失败: ' + e.message));
      process.exit(1);
    }
  })
  .command('stats', '查看统计数据', {}, () => {
    const stats = ObstacleService.getStatistics();
    
    console.log(chalk.bgCyan.white(' 统计数据 '));
    console.log(chalk.cyan('障碍物总数: ') + stats.totalObstacles);
    console.log(chalk.cyan('楼层剖面草图: ') + stats.totalFloorPlans);
    console.log(chalk.cyan('安全距离报告: ') + stats.totalReports);
    console.log(chalk.red('告警标签遮挡: ') + stats.blockedTags);
    console.log(chalk.yellow('待施工经理复核: ') + stats.pendingManagerReview);
    console.log(chalk.yellow('待补楼层剖面: ') + stats.pendingFloorPlan);
    console.log(chalk.green('已完成: ') + stats.completed);
  })
  .command('list-floorplans', '列出所有楼层剖面草图', {}, () => {
    const floorPlans = ObstacleService.getAllFloorPlans();
    
    const table = new Table({
      head: ['ID', '楼层', '名称', '小陶已复核'],
      colWidths: [20, 10, 30, 15]
    });
    
    floorPlans.forEach(f => {
      table.push([
        f.id,
        f.floor,
        f.name,
        f.reviewedByTao ? chalk.green('是') : chalk.yellow('否')
      ]);
    });
    
    console.log(table.toString());
  })
  .command('list-reports', '列出所有安全距离报告', {}, () => {
    const reports = ObstacleService.getAllReports();
    
    const table = new Table({
      head: ['ID', '障碍物ID', '标题', '状态'],
      colWidths: [25, 20, 35, 15]
    });
    
    reports.forEach(r => {
      table.push([r.id, r.obstacleId, r.title, r.status]);
    });
    
    console.log(table.toString());
  })
  .demandCommand(1, chalk.red('请指定命令'))
  .help()
  .argv;
