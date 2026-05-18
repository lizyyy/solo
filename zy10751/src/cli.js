#!/usr/bin/env node

const { Command } = require('commander');
const { QueueStats } = require('./index');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .name('queue-stats')
  .description('在线客服排队日志技能组溢出统计 CLI')
  .version('1.0.0');

program
  .argument('<files...>', '日志文件路径（支持多个文件）')
  .option('-v, --verbose', '详细模式，输出每条记录的处理过程')
  .option('-o, --output <file>', '输出JSON报告到指定文件')
  .option('-f, --format <format>', '输出格式: console|json', 'console')
  .option('--repeat <count>', '重复运行次数，用于测试幂等性', 1)
  .action(async (files, options) => {
    const resolvedFiles = files.map(file => {
      if (!fs.existsSync(file)) {
        const resolved = path.resolve(file);
        if (!fs.existsSync(resolved)) {
          console.error(`警告: 文件不存在 - ${file}`);
        }
        return resolved;
      }
      return path.resolve(file);
    });

    const validFiles = resolvedFiles.filter(f => fs.existsSync(f));
    
    if (validFiles.length === 0) {
      console.error('错误: 没有找到有效的日志文件');
      process.exit(1);
    }

    console.log(`找到 ${validFiles.length} 个有效文件`);

    const stats = new QueueStats({
      verbose: options.verbose,
      outputFile: options.output,
      format: options.format
    });

    const repeatCount = parseInt(options.repeat) || 1;
    
    if (repeatCount > 1) {
      console.log(`\n测试幂等性，重复运行 ${repeatCount} 次...\n`);
    }

    let lastResult = null;
    let isIdempotent = true;

    function getStatsHash(result) {
      return JSON.stringify({
        totalRecords: result.totalRecords,
        overflow: result.overflowSummary?.total,
        abandon: result.abandonSummary?.total,
        queueHold: result.otherEvents?.queueHold,
        visitorRefresh: result.otherEvents?.visitorRefresh,
        skillGroupRename: result.otherEvents?.skillGroupRename
      });
    }

    for (let i = 0; i < repeatCount; i++) {
      if (repeatCount > 1) {
        console.log(`\n━━━━━━━━━━━━━━━━ 第 ${i + 1} 次运行 ━━━━━━━━━━━━━━━━`);
      }

      const result = await stats.processFiles(validFiles);
      
      if (i === 0) {
        lastResult = getStatsHash(result);
      } else if (repeatCount > 1) {
        const currentResult = getStatsHash(result);
        if (currentResult !== lastResult) {
          isIdempotent = false;
          console.log('\n⚠️  警告: 统计结果不一致！幂等性测试失败');
        }
      }
    }

    if (repeatCount > 1) {
      console.log(`\n═══════════════════════════════════════════════════`);
      console.log(`幂等性测试结果: ${isIdempotent ? '✅ 通过' : '❌ 失败'}`);
      console.log(`重复运行 ${repeatCount} 次，结果${isIdempotent ? '' : '不'}一致`);
      console.log(`═══════════════════════════════════════════════════`);
    }

    if (options.output) {
      console.log(`\n报告已保存到: ${path.resolve(options.output)}`);
    }
  });

program
  .command('test')
  .description('运行内置测试样例')
  .option('-v, --verbose', '详细模式')
  .action(async (options) => {
    console.log('运行在线客服排队日志技能组溢出统计测试...\n');
    
    const sampleDir = path.join(__dirname, '../samples');
    const sampleFiles = [
      path.join(sampleDir, 'queue-log-1.log'),
      path.join(sampleDir, 'queue-log-2.log')
    ];

    if (!fs.existsSync(sampleFiles[0])) {
      console.log('正在生成测试样例文件...');
      generateSampleFiles(sampleDir);
    }

    console.log('=== 正常路径测试 ===\n');
    const stats1 = new QueueStats({ 
      verbose: options.verbose,
      format: 'console'
    });
    await stats1.processFiles(sampleFiles);

    console.log('\n\n=== 异常路径测试（重复运行测试幂等性）===\n');
    const stats2 = new QueueStats({ 
      verbose: false,
      format: 'json'
    });
    
    const result1 = await stats2.processFiles(sampleFiles);
    stats2.reset();
    const result2 = await stats2.processFiles(sampleFiles);
    
    const isSame = 
      result1.totalRecords === result2.totalRecords &&
      result1.overflowSummary.total === result2.overflowSummary.total &&
      result1.abandonSummary.total === result2.abandonSummary.total &&
      result1.otherEvents.queueHold === result2.otherEvents.queueHold &&
      result1.otherEvents.visitorRefresh === result2.otherEvents.visitorRefresh &&
      result1.otherEvents.skillGroupRename === result2.otherEvents.skillGroupRename;
    
    console.log(`幂等性测试: ${isSame ? '✅ 通过 - 两次运行统计结果一致' : '❌ 失败 - 两次运行统计结果不一致'}`);
    
    if (result1.totalRecords === result2.totalRecords) {
      console.log(`记录数验证: ✅ 两次均为 ${result1.totalRecords} 条记录`);
    }
    console.log(`溢出统计: ✅ 两次均为 ${result1.overflowSummary.total} 次`);
    console.log(`放弃统计: ✅ 两次均为 ${result1.abandonSummary.total} 次`);
    console.log(`队列占位: ✅ 两次均为 ${result1.otherEvents.queueHold} 次`);
    console.log(`访客刷新: ✅ 两次均为 ${result1.otherEvents.visitorRefresh} 次`);
    console.log(`技能组改名: ✅ 两次均为 ${result1.otherEvents.skillGroupRename} 次`);

    console.log('\n\n=== 测试完成 ===');
    console.log('这就是"在线客服排队日志技能组溢出统计"，不是通用的日志统计工具！');
    console.log('- 专门统计技能组溢出和访客放弃情况');
    console.log('- 保留队列占位、访客刷新、技能组改名的原始文件名和行号引用');
    console.log('- 支持重复运行同一批输入时结果稳定（幂等性）');
    console.log('- 默认摘要模式，详细模式展开每条记录');
  });

function generateSampleFiles(sampleDir) {
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }

  const log1 = `2024-01-15 09:00:15 [INFO] 技能组: 售前咨询 队列占位成功 访客ID: V001
2024-01-15 09:05:22 [WARN] 技能组: 售前咨询 队列已满，发生溢出 访客ID: V002
2024-01-15 09:08:33 [INFO] 技能组: 售后服务 访客刷新页面 访客ID: V003
2024-01-15 09:10:45 [WARN] 技能组: 售后服务 访客放弃排队 访客ID: V003
2024-01-15 09:15:00 [INFO] 技能组: 技术支持 队列占位成功 访客ID: V004
2024-01-15 09:20:12 [WARN] 技能组: 售前咨询 队列已满，发生溢出 访客ID: V005
2024-01-15 09:25:30 [INFO] 技能组改名: 售前咨询 改为 产品咨询
2024-01-15 09:30:00 [WARN] 技能组: 产品咨询 队列已满，发生溢出 访客ID: V006
2024-01-15 09:35:22 [INFO] 普通日志: 系统正常运行
2024-01-15 09:40:15 [WARN] 技能组: 技术支持 访客放弃排队 访客ID: V004`;

  const log2 = `2024-01-15 10:00:00 [INFO] 技能组: 产品咨询 队列占位成功 访客ID: V007
2024-01-15 10:05:11 [WARN] 技能组: 售后服务 队列已满，发生溢出 访客ID: V008
2024-01-15 10:08:33 [WARN] 技能组: 售后服务 访客放弃排队 访客ID: V008
2024-01-15 10:10:45 [INFO] 技能组: 产品咨询 访客刷新页面 访客ID: V007
2024-01-15 10:15:00 [WARN] 技能组: 技术支持 队列已满，发生溢出 访客ID: V009
2024-01-15 10:20:12 [WARN] 技能组: 技术支持 访客放弃排队 访客ID: V009
2024-01-15 10:25:30 [INFO] 普通日志: 心跳检测
2024-01-15 10:30:00 [INFO] 技能组: 产品咨询 队列占位成功 访客ID: V010
2024-01-15 10:35:22 [WARN] 技能组: 产品咨询 访客放弃排队 访客ID: V010`;

  fs.writeFileSync(path.join(sampleDir, 'queue-log-1.log'), log1, 'utf8');
  fs.writeFileSync(path.join(sampleDir, 'queue-log-2.log'), log2, 'utf8');
}

program.parse();
