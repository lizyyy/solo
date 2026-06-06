#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { importTicketsFromCsv, getAllBatches, getTicketsByBatch, getTicketById } from '../services/ticketImporter';
import { 
  generateInitialRemindersForBatch, 
  getRemindersByAssignee, 
  getAllReminders,
  recordingEngineerReview,
  getReminderByTicketId
} from '../services/authReminder';
import { updateAudioRemark, getAudioFilesByBatch } from '../services/audioManager';
import { getBatchVisualization, getOverviewChartData, getTicketTrace } from '../services/visualizer';

const program = new Command();

program
  .name('sac')
  .description('采样包授权链路 - Sampling Auth Chain CLI')
  .version('1.0.0');

program.command('import <file>')
  .description('导入票务导出表 (CSV格式)')
  .action((file) => {
    console.log(chalk.blue('\n=== 导入票务导出表...'));
    const result = importTicketsFromCsv(file);

    if (result.success) {
      console.log(chalk.green('✓ 导入成功!'));
      console.log(`  总记录数: ${result.totalRecords}`);
      console.log(`  新建批次: ${result.batchesCreated.length}`);
      
      if (result.mixedBatches.length > 0) {
        console.log(chalk.yellow(`  ⚠ 发现混批: ${result.mixedBatches.length} 个`));
        result.mixedBatches.forEach(b => console.log(`    - ${b}`));
      }
      
      result.batchesCreated.forEach(batchId => {
        console.log(chalk.gray(`\n  为批次 ${batchId} 生成授权提醒...`));
        const reminders = generateInitialRemindersForBatch(batchId);
        console.log(`  生成 ${reminders.length} 条提醒`);
      });
      
    } else {
      console.log(chalk.red('✗ 导入失败:'));
      result.errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log();
  });

program.command('batches')
  .description('查看所有批次列表')
  .action(() => {
    const batches = getAllBatches();
    
    const table = new Table({
      head: [
        chalk.cyan('批次ID'),
        chalk.cyan('总数'),
        chalk.cyan('售票'),
        chalk.cyan('赠票'),
        chalk.cyan('混批'),
        chalk.cyan('状态'),
        chalk.cyan('导入时间')
      ],
      colWidths: [20, 8, 8, 8, 8, 12, 25]
    });

    batches.forEach(b => {
      table.push([
        b.batchId,
        b.totalCount,
        b.paidCount,
        b.complimentaryCount,
        b.hasMixedTypes ? chalk.red('是') : chalk.green('否'),
        b.reviewStatus === 'new' ? chalk.yellow('新建') :
        b.reviewStatus === 'in_review' ? chalk.blue('处理中') : chalk.green('已完成'),
        new Date(b.importDate).toLocaleString()
      ]);
    });

    console.log(chalk.blue('\n=== 批次列表 ==='));
    console.log(table.toString());
    console.log();
  });

program.command('batch <batchId>')
  .description('查看批次详情')
  .action((batchId) => {
    const tickets = getTicketsByBatch(batchId);
    const viz = getBatchVisualization(batchId);
    
    if (!viz) {
      console.log(chalk.red(`批次 ${batchId} 不存在`));
      return;
    }

    console.log(chalk.blue(`\n=== 批次详情: ${batchId} ===`));
    console.log(`  总数: ${viz.totalCount} | 售票: ${viz.paidCount} | 赠票: ${viz.complimentaryCount}`);
    console.log(`  混批: ${viz.hasMixedTypes ? chalk.red('是') : chalk.green('否')}`);
    console.log(`  状态: ${viz.reviewStatus}`);
    
    const table = new Table({
      head: [
        chalk.cyan('票号'),
        chalk.cyan('类型'),
        chalk.cyan('参会人'),
        chalk.cyan('授权状态'),
        chalk.cyan('音频备注'),
        chalk.cyan('溯源链接')
      ],
      colWidths: [15, 10, 15, 15, 25, 20]
    });

    viz.tickets.forEach(t => {
      table.push([
        t.ticketNo,
        t.ticketType === 'paid' ? chalk.green('售票') : chalk.yellow('赠票'),
        t.attendeeName,
        t.authStatus,
        t.audioRemark || '-',
        t.sourceLink.type === 'audio_file' ? 
          chalk.blue(t.sourceLink.reference) : chalk.gray(t.sourceLink.reference)
      ]);
    });

    console.log('\n' + table.toString());
    console.log();
  });

program.command('reminders [role]')
  .description('查看授权提醒 [role: recording_engineer | copyright_operations]')
  .action((role) => {
    let reminders;
    if (role) {
      reminders = getRemindersByAssignee(role as any);
    } else {
      reminders = getAllReminders();
    }

    console.log(chalk.blue('\n=== 授权提醒列表 ==='));
    
    reminders.forEach(r => {
      const statusColor = 
        r.status === 'needs_review' ? chalk.yellow :
        r.status === 'approved' ? chalk.green :
        r.status === 'rejected' ? chalk.red :
        r.status === 'audio_verified' ? chalk.blue : chalk.gray;
      
      console.log(`\n${chalk.bold(`[${r.ticketNo}]`)} ${statusColor(r.status)}`);
      console.log(`  批次: ${r.batchId}`);
      console.log(`  原因: ${r.reason}`);
      if (r.missingMaterials.length > 0) {
        console.log(`  缺材料: ${r.missingMaterials.join(', ')}`);
      }
      console.log(`  下一步: ${chalk.cyan(r.nextStep)}`);
      console.log(`  负责人: ${r.assignee === 'recording_engineer' ? '录音师' : '版权运营小鹿'}`);
    });
    
    if (reminders.length === 0) {
      console.log(chalk.gray('  暂无提醒'));
    }
    console.log();
  });

program.command('add-remark <ticketId> <remark>')
  .description('版权运营小鹿补录音频文件备注')
  .action((ticketId, remark) => {
    console.log(chalk.blue('\n=== 补录音频备注...'));
    const success = updateAudioRemark(parseInt(ticketId), remark, 'copyright_operations');
    
    if (success) {
      console.log(chalk.green('✓ 备注已更新'));
      const reminder = getReminderByTicketId(parseInt(ticketId));
      if (reminder) {
        console.log(`\n  更新后的提醒:`);
        console.log(`  状态: ${chalk.cyan(reminder.status)}`);
        console.log(`  原因: ${reminder.reason}`);
        console.log(`  下一步: ${reminder.nextStep}`);
      }
    } else {
      console.log(chalk.red('✗ 更新失败'));
    }
    console.log();
  });

program.command('review <ticketId> <approve|reject> [remark]')
  .description('录音师复核 (approve/reject)')
  .action((ticketId, action, remark) => {
    console.log(chalk.blue('\n=== 录音师复核...'));
    const approve = action === 'approve';
    const defaultRemark = approve ? '确认在授权范围内' : '不在授权范围内';
    const result = recordingEngineerReview(parseInt(ticketId), approve, remark || defaultRemark);
    
    if (result) {
      console.log(chalk.green(`✓ 复核${approve ? '通过' : '驳回'}`));
      console.log(`  状态: ${chalk.cyan(result.status)}`);
      console.log(`  原因: ${result.reason}`);
      console.log(`  下一步: ${result.nextStep}`);
    } else {
      console.log(chalk.red('✗ 复核失败'));
    }
    console.log();
  });

program.command('trace <ticketId>')
  .description('查看票据授权溯源链路')
  .action((ticketId) => {
    const trace = getTicketTrace(parseInt(ticketId));
    if (!trace) {
      console.log(chalk.red('找不到该票据'));
      return;
    }

    console.log(chalk.blue(`\n=== 授权溯源: ${trace.ticketNo} (批次: ${trace.batchId}) ===`));
    
    console.log(chalk.yellow('\n  授权轨迹:'));
    trace.authTrail.forEach((step, i) => {
      console.log(`  ${i + 1}. [${step.timestamp}] ${chalk.cyan(step.status)}`);
      console.log(`     原因: ${step.reason}`);
      console.log(`     负责人: ${step.assignee === 'recording_engineer' ? '录音师' : '版权运营小鹿'}`);
    });

    console.log(chalk.yellow('\n  溯源参考:'));
    trace.sourceReferences.forEach(ref => {
      console.log(`  • ${chalk.blue(ref.reference)} - ${ref.description}`);
    });
    console.log();
  });

program.command('overview')
  .description('查看整体统计概览')
  .action(() => {
    const chartData = getOverviewChartData();
    const batches = getAllBatches();
    
    console.log(chalk.blue('\n=== 整体概览 ==='));
    console.log(`  总批次数: ${batches.length}`);
    console.log(`  混批批次: ${chartData.datasets[0].data[0]}`);
    console.log(`  纯批次: ${chartData.datasets[0].data[1]}`);
    console.log(`  待处理: ${chartData.datasets[0].data[2]}`);
    console.log(`  处理中: ${chartData.datasets[0].data[3]}`);
    console.log(`  已完成: ${chartData.datasets[0].data[4]}`);
    
    console.log(chalk.yellow('\n  图表数据 (用于可视化):'));
    console.log(`  ${JSON.stringify(chartData, null, 2)}`);
    console.log();
  });

program.command('demo')
  .description('运行完整演示流程')
  .action(() => {
    console.log(chalk.bold(chalk.blue('\n╔════════════════════════════════════════╗')));
    console.log(chalk.bold(chalk.blue('║   采样包授权链路 - 完整流程演示      ║')));
    console.log(chalk.bold(chalk.blue('╚════════════════════════════════════════╝')));
    
    const sampleFile = './data/samples/tickets_sample.csv';
    
    console.log(chalk.yellow('\n步骤 1: 导入票务导出表'));
    console.log(chalk.gray('  执行: sac import ' + sampleFile));
    
    const { execSync } = require('child_process');
    try {
      execSync(`node dist/cli/index.js import ${sampleFile}`, { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.yellow('\n步骤 2: 查看批次列表'));
    console.log(chalk.gray('  执行: sac batches'));
    try {
      execSync('node dist/cli/index.js batches', { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.yellow('\n步骤 3: 查看授权提醒 (版权运营小鹿视角)'));
    console.log(chalk.gray('  执行: sac reminders copyright_operations'));
    try {
      execSync('node dist/cli/index.js reminders copyright_operations', { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.yellow('\n步骤 4: 版权运营小鹿补录音频备注'));
    console.log(chalk.gray('  执行: sac add-remark 1 "确认音频质量合格，采样可用"'));
    try {
      execSync('node dist/cli/index.js add-remark 1 "确认音频质量合格，采样可用"', { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.yellow('\n步骤 5: 查看授权提醒 (录音师视角)'));
    console.log(chalk.gray('  执行: sac reminders recording_engineer'));
    try {
      execSync('node dist/cli/index.js reminders recording_engineer', { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.yellow('\n步骤 6: 录音师复核混批中的赠票'));
    console.log(chalk.gray('  执行: sac review 3 approve "该赠票嘉宾确认在授权范围内"'));
    try {
      execSync('node dist/cli/index.js review 3 approve "该赠票嘉宾确认在授权范围内"', { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.yellow('\n步骤 7: 查看票据授权溯源'));
    console.log(chalk.gray('  执行: sac trace 3'));
    try {
      execSync('node dist/cli/index.js trace 3', { stdio: 'inherit' });
    } catch (e) {}
    
    console.log(chalk.green('\n✓ 演示流程完成!'));
    console.log(chalk.gray('  新人可通过 sac --help 查看更多命令\n'));
  });

program.parse(process.argv);
