#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const Table = require('cli-table3');
const fs = require('fs');

const SignatureVerifier = require('./core/signature');
const MessageStore = require('./core/messageStore');
const SmsMessage = require('./core/smsMessage');
const ReportGenerator = require('./core/reportGenerator');

const program = new Command();
const verifier = new SignatureVerifier();
const store = new MessageStore();
const reporter = new ReportGenerator();

program
  .name('qmc')
  .description('队列消息体检查命令行工具')
  .version('1.0.0');

program
  .command('demo')
  .description('运行演示流程，包含正常消息和异常消息')
  .option('--preview', '预览模式，仅显示影响范围不执行')
  .action(async (options) => {
    console.log(chalk.bgBlue.white.bold(' 队列消息体检查 - 演示模式 ') + '\n');
    
    const demoData = SmsMessage.generateDemoData();
    const batchId = `BATCH_${Date.now()}`;
    const expectedAlgorithm = 'MD5';

    console.log(chalk.cyan(`准备演示数据:`));
    console.log(`  - 正常消息: ${demoData.normal.length} 条 (使用 ${expectedAlgorithm} 算法)`);
    console.log(`  - 异常消息: ${demoData.abnormal.length} 条 (使用错误算法)`);
    console.log(`  - 批次ID: ${batchId}`);
    console.log(`  - 期望签名算法: ${expectedAlgorithm}\n`);

    if (options.preview) {
      console.log(chalk.yellow('⚠️  预览模式 - 预计影响范围:'));
      const previewTable = new Table({
        head: ['类型', '数量', '预计结果', '说明'],
        colWidths: [12, 10, 12, 40]
      });
      previewTable.push(
        ['正常消息', demoData.normal.length, chalk.green('验证通过'), '签名算法正确'],
        ['异常消息', demoData.abnormal.length, chalk.red('验证失败'), '签名算法不一致 (SHA256 vs MD5)']
      );
      console.log(previewTable.toString() + '\n');
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '确认执行验证流程?',
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.gray('已取消执行\n'));
        return;
      }
    }

    const startTime = Date.now();
    const results = [];

    console.log(chalk.cyan('开始验证消息...\n'));

    for (const message of demoData.all) {
      const existing = store.findExistingResult(message, batchId);
      
      if (existing) {
        if (existing.differentBatch) {
          console.log(chalk.yellow(`⚠️  消息 ${message.messageId} 已在批次 ${existing.previousBatchId} 处理过，复用旧结论`));
        } else {
          console.log(chalk.yellow(`⚠️  消息 ${message.messageId} 已在当前批次处理过`));
        }
        results.push({ message, result: existing.result, reused: true });
        continue;
      }

      const result = verifier.verify(message, expectedAlgorithm);
      results.push({ message, result, reused: false });
      store.saveResult(message, result, batchId, Date.now());

      const status = result.valid ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${message.messageId} - ${message.phone}`);
    }

    const executionTime = Date.now() - startTime;

    reporter.generateCliReport(results, executionTime, batchId);
    const htmlPath = reporter.generateHtmlReport(results, executionTime, batchId);
    
    console.log(chalk.green(`✅ HTML报告已生成: ${htmlPath}\n`));

    const abnormalCount = results.filter(r => !r.result.valid).length;
    if (abnormalCount > 0) {
      const { exportAbnormal } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'exportAbnormal',
          message: `是否导出 ${abnormalCount} 条异常样本供同事复核?`,
          default: true
        }
      ]);
      
      if (exportAbnormal) {
        const exportPath = `abnormal_${batchId}.json`;
        reporter.exportAbnormalSamples(results, exportPath);
        console.log(chalk.green(`✅ 异常样本已导出至: ${exportPath}\n`));
      }
    }
  });

program
  .command('verify')
  .description('验证消息文件中的签名')
  .requiredOption('--input <path>', '输入消息JSON文件')
  .option('--algorithm <algorithm>', '期望的签名算法', 'MD5')
  .option('--preview', '预览模式，仅显示影响范围不执行')
  .action(async (options) => {
    console.log(chalk.bgBlue.white.bold(' 队列消息体检查 ') + '\n');

    if (!fs.existsSync(options.input)) {
      console.log(chalk.red(`❌ 输入文件不存在: ${options.input}\n`));
      process.exit(1);
    }

    const messages = JSON.parse(fs.readFileSync(options.input, 'utf8'));
    const batchId = `BATCH_${Date.now()}`;

    console.log(chalk.cyan(`加载数据:`));
    console.log(`  - 消息文件: ${options.input}`);
    console.log(`  - 消息数量: ${messages.length} 条`);
    console.log(`  - 期望算法: ${options.algorithm}`);
    console.log(`  - 批次ID: ${batchId}\n`);

    if (options.preview) {
      console.log(chalk.yellow('⚠️  预览模式 - 消息预览:'));
      const previewTable = new Table({
        head: ['序号', '消息ID', '手机号', '签名算法', '内容摘要'],
        colWidths: [8, 22, 15, 12, 35]
      });
      
      messages.slice(0, 10).forEach((msg, index) => {
        previewTable.push([
          index + 1,
          msg.messageId,
          msg.phone,
          msg.signMethod,
          msg.content.substring(0, 30) + '...'
        ]);
      });
      
      if (messages.length > 10) {
        previewTable.push(['...', '...', '...', '...', `还有 ${messages.length - 10} 条消息`]);
      }
      
      console.log(previewTable.toString() + '\n');

      const algorithmStats = {};
      messages.forEach(msg => {
        algorithmStats[msg.signMethod] = (algorithmStats[msg.signMethod] || 0) + 1;
      });
      
      console.log(chalk.cyan('签名算法统计:'));
      Object.entries(algorithmStats).forEach(([algo, count]) => {
        const match = algo === options.algorithm ? chalk.green('✓ 匹配') : chalk.red('✗ 不匹配');
        console.log(`  - ${algo}: ${count} 条 ${match}`);
      });
      console.log('');

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `确认对 ${messages.length} 条消息执行验证?`,
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.gray('已取消执行\n'));
        return;
      }
    }

    const startTime = Date.now();
    const results = [];
    let conflictCount = 0;

    console.log(chalk.cyan('开始验证消息...\n'));

    for (const message of messages) {
      const existing = store.findExistingResult(message, batchId);
      
      if (existing) {
        const newResult = verifier.verify(message, options.algorithm);
        const conflict = store.checkConflict(message, batchId, newResult);
        
        if (conflict.hasConflict) {
          conflictCount++;
          console.log(chalk.red(`⚠️  冲突检测: 消息 ${message.messageId} 历史结论与新结论不一致!`));
        }
        
        results.push({ message, result: existing.result, reused: true, conflict: conflict.hasConflict });
        continue;
      }

      const result = verifier.verify(message, options.algorithm);
      results.push({ message, result, reused: false, conflict: false });
      store.saveResult(message, result, batchId, Date.now());

      const status = result.valid ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${message.messageId} - ${message.phone}`);
    }

    const executionTime = Date.now() - startTime;

    reporter.generateCliReport(results, executionTime, batchId);
    const htmlPath = reporter.generateHtmlReport(results, executionTime, batchId);
    
    console.log(chalk.green(`✅ HTML报告已生成: ${htmlPath}\n`));

    if (conflictCount > 0) {
      console.log(chalk.red(`⚠️  检测到 ${conflictCount} 条历史结论冲突，请人工复核\n`));
    }

    const abnormalCount = results.filter(r => !r.result.valid).length;
    if (abnormalCount > 0) {
      const { exportAbnormal } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'exportAbnormal',
          message: `是否导出 ${abnormalCount} 条异常样本供同事复核?`,
          default: true
        }
      ]);
      
      if (exportAbnormal) {
        const exportPath = `abnormal_${batchId}.json`;
        reporter.exportAbnormalSamples(results, exportPath);
        console.log(chalk.green(`✅ 异常样本已导出至: ${exportPath}\n`));
      }
    }
  });

program
  .command('generate')
  .description('生成测试消息数据')
  .option('--count <number>', '生成消息数量', '5')
  .option('--algorithm <algorithm>', '签名算法', 'MD5')
  .option('--with-bad', '包含一条算法不一致的坏消息')
  .option('--output <path>', '输出文件路径', 'messages.json')
  .action((options) => {
    console.log(chalk.bgBlue.white.bold(' 生成测试消息数据 ') + '\n');

    const count = parseInt(options.count);
    const messages = SmsMessage.generateBatch(count, options.algorithm).map(m => m.toJSON());
    
    if (options.withBad) {
      const badMessage = SmsMessage.generateBadMessage(
        '13900009999',
        '【物流拦截】异常包裹需拦截，请核实',
        'SHA256',
        options.algorithm
      );
      messages.push(badMessage.toJSON());
    }

    fs.writeFileSync(options.output, JSON.stringify(messages, null, 2));
    
    console.log(chalk.cyan(`生成完成:`));
    console.log(`  - 正常消息: ${count} 条 (${options.algorithm} 算法)`);
    if (options.withBad) {
      console.log(`  - 异常消息: 1 条 (SHA256 算法 - 不一致)`);
    }
    console.log(`  - 输出文件: ${options.output}`);
    console.log(chalk.green(`\n✅ 数据已生成\n`));
  });

program
  .command('export')
  .description('导出批次处理结果')
  .requiredOption('--batch <id>', '批次ID')
  .option('--output <path>', '输出文件路径', 'export.json')
  .option('--abnormal-only', '仅导出异常样本')
  .action((options) => {
    console.log(chalk.bgBlue.white.bold(' 导出批次结果 ') + '\n');

    const batchResults = store.getBatchResults(options.batch);
    
    if (Object.keys(batchResults).length === 0) {
      console.log(chalk.red(`❌ 未找到批次: ${options.batch}\n`));
      process.exit(1);
    }

    let results = Object.values(batchResults);
    
    if (options.abnormalOnly) {
      results = results.filter(r => !r.result.valid);
      console.log(chalk.cyan(`仅导出异常样本: ${results.length} 条\n`));
    } else {
      console.log(chalk.cyan(`导出全部结果: ${results.length} 条\n`));
    }

    store.exportBatch(options.batch, options.output);
    
    console.log(chalk.green(`✅ 批次结果已导出至: ${options.output}\n`));
  });

program
  .command('history')
  .description('查看历史处理批次')
  .action(() => {
    console.log(chalk.bgBlue.white.bold(' 历史处理批次 ') + '\n');

    const batches = store.getAllBatches();
    
    if (batches.length === 0) {
      console.log(chalk.gray('暂无历史记录\n'));
      return;
    }

    const table = new Table({
      head: ['序号', '批次ID', '消息数量', '通过数量', '失败数量'],
      colWidths: [8, 30, 12, 12, 12]
    });

    batches.forEach((batchId, index) => {
      const results = store.getBatchResults(batchId);
      const values = Object.values(results);
      const valid = values.filter(r => r.result.valid).length;
      const invalid = values.filter(r => !r.result.valid).length;
      
      table.push([
        index + 1,
        batchId,
        values.length,
        chalk.green(valid),
        chalk.red(invalid)
      ]);
    });

    console.log(table.toString() + '\n');
    console.log(chalk.cyan('导出指定批次:') + ' qmc export --batch <批次ID>\n');
  });

program.parse(process.argv);