#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const { KnowledgeStore } = require('./lib/storage');
const { ErrorFingerprint } = require('./lib/models');
const { SimilarityEngine } = require('./lib/similarity');
const {
  formatEntryDetail,
  formatEntrySummary,
  formatSuggestionResult,
  formatReport
} = require('./lib/formatter');

const program = new Command();
const store = new KnowledgeStore();
const similarityEngine = new SimilarityEngine();

program
  .name('failure-kb')
  .description('任务失败知识库 CLI - 记录和搜索任务失败处理经验')
  .version('1.0.0');

program
  .command('ingest')
  .description('导入任务失败日志')
  .requiredOption('-t, --task <name>', '任务名称')
  .option('-m, --message <text>', '错误信息')
  .option('-s, --stack <text>', '错误堆栈')
  .option('-f, --file <path>', '从文件读取错误信息')
  .option('-c, --context <json>', '任务上下文 (JSON格式)')
  .option('-n, --notes <text>', '处理备注')
  .option('-r, --resolution <text>', '解决方案')
  .action((options) => {
    let errorMessage = options.message || '';
    let stackTrace = options.stack || '';

    if (options.file) {
      try {
        const fileContent = fs.readFileSync(options.file, 'utf8');
        if (!errorMessage) errorMessage = fileContent;
        if (!stackTrace) stackTrace = fileContent;
      } catch (err) {
        console.error(chalk.red(`读取文件失败: ${err.message}`));
        process.exit(1);
      }
    }

    if (!errorMessage && !stackTrace) {
      console.error(chalk.red('必须提供错误信息 (--message) 或堆栈 (--stack) 或文件 (--file)'));
      process.exit(1);
    }

    let context = {};
    if (options.context) {
      try {
        context = JSON.parse(options.context);
      } catch (err) {
        console.error(chalk.red('上下文 JSON 格式错误'));
        process.exit(1);
      }
    }

    const { entry, isNew } = store.addOrUpdate({
      taskName: options.task,
      errorMessage,
      stackTrace,
      context,
      notes: options.notes,
      resolution: options.resolution
    });

    if (isNew) {
      console.log(chalk.green('✓ 已创建新知识条目'));
    } else {
      console.log(chalk.yellow('⚠ 已更新现有条目 (相同错误指纹)'));
    }
    console.log(formatEntryDetail(entry));
  });

program
  .command('search')
  .description('搜索历史知识')
  .option('-t, --task <name>', '按任务名称搜索')
  .option('-s, --status <status>', '按状态筛选 (pending/resolved)')
  .option('-e, --expired', '只显示过期条目')
  .option('-a, --active', '只显示有效条目')
  .option('-r, --review', '只显示需复核条目')
  .option('-i, --id <id>', '按ID查看详情')
  .action((options) => {
    if (options.id) {
      const entry = store.findById(options.id);
      if (!entry) {
        console.error(chalk.red('未找到该条目'));
        process.exit(1);
      }
      console.log(formatEntryDetail(entry));
      return;
    }

    const filter = {};
    if (options.task) filter.taskName = options.task;
    if (options.status) filter.status = options.status;
    if (options.expired) filter.expired = true;
    if (options.active) filter.expired = false;
    if (options.review) filter.needsReview = true;

    const entries = store.getAll(filter);

    if (entries.length === 0) {
      console.log(chalk.yellow('未找到匹配的条目'));
      return;
    }

    console.log(chalk.bold(`\n找到 ${entries.length} 个条目:\n`));
    entries.forEach((entry, i) => {
      console.log(formatEntrySummary(entry, i + 1));
      console.log('');
    });
  });

program
  .command('suggest')
  .description('根据新失败推荐相似历史解决方案')
  .requiredOption('-t, --task <name>', '任务名称')
  .option('-m, --message <text>', '错误信息')
  .option('-s, --stack <text>', '错误堆栈')
  .option('-f, --file <path>', '从文件读取错误信息')
  .option('-c, --context <json>', '任务上下文 (JSON格式)')
  .option('-n, --limit <number>', '返回结果数量', '5')
  .option('--threshold <number>', '相似度阈值 (0-1)', '0.2')
  .action((options) => {
    let errorMessage = options.message || '';
    let stackTrace = options.stack || '';

    if (options.file) {
      try {
        const fileContent = fs.readFileSync(options.file, 'utf8');
        if (!errorMessage) errorMessage = fileContent;
        if (!stackTrace) stackTrace = fileContent;
      } catch (err) {
        console.error(chalk.red(`读取文件失败: ${err.message}`));
        process.exit(1);
      }
    }

    let context = {};
    if (options.context) {
      try {
        context = JSON.parse(options.context);
      } catch (err) {
        console.error(chalk.red('上下文 JSON 格式错误'));
        process.exit(1);
      }
    }

    const fingerprint = new ErrorFingerprint({
      taskName: options.task,
      errorMessage,
      stackTrace,
      context
    });

    const allEntries = store.getAll();
    const threshold = parseFloat(options.threshold);
    const limit = parseInt(options.limit);

    const results = similarityEngine.findSimilar(fingerprint, allEntries, threshold);
    const topResults = results.slice(0, limit);

    if (topResults.length === 0) {
      console.log(chalk.yellow('\n未找到相似的历史记录'));
      console.log(chalk.gray('建议: 使用 ingest 命令将此失败记录到知识库'));
      console.log(`\n错误指纹: ${chalk.red(fingerprint.errorCode)}`);
      console.log(`任务: ${chalk.blue(options.task)}`);
      return;
    }

    console.log(chalk.bold(`\n找到 ${topResults.length} 个相似条目 (共 ${results.length} 个匹配)\n`));
    
    topResults.forEach((result, i) => {
      console.log(formatSuggestionResult(result, i + 1));
    });

    console.log(chalk.gray('\n提示: 使用 resolve --id <ID> 记录处理结果或反馈'));
    console.log(chalk.gray('      使用 feedback --id <ID> --useful/--not-useful 反馈推荐效果'));
  });

program
  .command('resolve')
  .description('记录处理结果')
  .requiredOption('-i, --id <id>', '知识条目ID')
  .option('-r, --resolution <text>', '解决方案')
  .option('-n, --notes <text>', '处理备注')
  .option('-b, --by <name>', '处理人')
  .option('--extend', '延长过期时间')
  .action((options) => {
    const entry = store.findById(options.id);
    if (!entry) {
      console.error(chalk.red('未找到该条目'));
      process.exit(1);
    }

    if (options.extend) {
      const updated = store.extendExpiry(options.id);
      console.log(chalk.green('✓ 已延长过期时间'));
      console.log(formatEntryDetail(updated));
      return;
    }

    if (!options.resolution) {
      console.log(formatEntryDetail(entry));
      console.log(chalk.yellow('\n提示: 使用 -r/--resolution 添加解决方案'));
      return;
    }

    const updated = store.resolve(
      options.id,
      options.resolution,
      options.notes,
      options.by
    );

    console.log(chalk.green('✓ 已记录处理结果'));
    console.log(formatEntryDetail(updated));
  });

program
  .command('feedback')
  .description('对推荐结果反馈有用/无用')
  .requiredOption('-i, --id <id>', '知识条目ID')
  .option('--useful', '标记为有用')
  .option('--not-useful', '标记为无用')
  .action((options) => {
    const entry = store.findById(options.id);
    if (!entry) {
      console.error(chalk.red('未找到该条目'));
      process.exit(1);
    }

    if (!options.useful && !options.notUseful) {
      console.log(chalk.yellow('当前反馈统计:'));
      console.log(`  有用: ${chalk.green(entry.usefulCount)}`);
      console.log(`  无用: ${chalk.red(entry.notUsefulCount)}`);
      console.log(`  评分: ${entry.feedbackScore}`);
      console.log(chalk.gray('\n使用 --useful 或 --not-useful 进行反馈'));
      return;
    }

    const updated = store.updateFeedback(options.id, !!options.useful);
    
    if (options.useful) {
      console.log(chalk.green('✓ 感谢反馈！此解决方案已标记为有用'));
    } else {
      console.log(chalk.yellow('⚠ 已标记为无用，下次推荐会降低优先级'));
    }
    
    console.log(formatEntryDetail(updated));
  });

program
  .command('report')
  .description('导出知识报告')
  .option('-o, --output <path>', '输出文件路径')
  .option('--json', '以 JSON 格式输出')
  .action((options) => {
    const stats = store.getStats();
    const entries = store.getAll();

    if (options.json) {
      const report = {
        generatedAt: new Date().toISOString(),
        stats,
        entries: entries.map(e => e.toObject())
      };
      const jsonOutput = JSON.stringify(report, null, 2);
      
      if (options.output) {
        fs.writeFileSync(options.output, jsonOutput, 'utf8');
        console.log(chalk.green(`✓ JSON 报告已保存到: ${options.output}`));
      } else {
        console.log(jsonOutput);
      }
      return;
    }

    const reportText = formatReport(stats, entries);
    
    if (options.output) {
      fs.writeFileSync(options.output, reportText, 'utf8');
      console.log(chalk.green(`✓ 报告已保存到: ${options.output}`));
    } else {
      console.log(reportText);
    }
  });

program
  .command('init-samples')
  .description('初始化示例数据 (数据库超时、权限缺失、数据格式错误、外部依赖失败)')
  .action(() => {
    const samples = [
      {
        taskName: 'daily-report-generator',
        errorMessage: 'Error: Connection timeout after 30000ms',
        stackTrace: `Error: Connection timeout after 30000ms
    at Connection._handleTimeoutError (/app/node_modules/mysql/lib/Connection.js:199:17)
    at listOnTimeout (internal/timers.js:554:17)
    at processTimers (internal/timers.js:497:7)`,
        context: { database: 'reports_db', query: 'SELECT * FROM daily_stats' },
        notes: '每天凌晨3点左右出现，数据库负载高',
        resolution: `处理步骤：
1. 检查数据库连接池配置
2. 查看慢查询日志: SHOW PROCESSLIST
3. 临时解决方案: 重启任务重试
4. 长期优化: 添加索引到 daily_stats 表的 date 字段
5. 考虑调整任务执行时间到非高峰时段`,
        status: 'resolved'
      },
      {
        taskName: 'data-import-job',
        errorMessage: 'AccessDeniedException: User: arn:aws:iam::123456:user/worker is not authorized to perform: s3:GetObject',
        stackTrace: `AccessDeniedException: User: arn:aws:iam::123456:user/worker is not authorized
    at Request.extractError (/app/node_modules/aws-sdk/lib/services/s3.js:712:35)
    at Request.callListeners (/app/node_modules/aws-sdk/lib/sequential_executor.js:106:20)`,
        context: { bucket: 'prod-data-import', region: 'us-east-1' },
        notes: '新部署的worker权限不足',
        resolution: `处理步骤：
1. 确认 IAM 角色/用户配置
2. 检查 S3 bucket 策略
3. 需要的权限: s3:GetObject, s3:ListBucket
4. 更新 IAM policy 后等待 5 分钟生效
5. 验证: aws s3 ls s3://prod-data-import/`,
        status: 'resolved'
      },
      {
        taskName: 'user-sync-service',
        errorMessage: 'ValidationError: Invalid JSON format at position 452',
        stackTrace: `ValidationError: Invalid JSON format at position 452
    at JSON.parse (<anonymous>)
    at parseUserData (/app/src/parsers/user.js:23:15)
    at processBatch (/app/src/services/sync.js:87:22)`,
        context: { source: 'api-gateway', batchSize: 100 },
        notes: '上游API返回的数据格式变化',
        resolution: `处理步骤：
1. 查看原始数据: cat /tmp/failed_batch_*.json
2. 使用 jq 验证: jq . /tmp/failed_batch_*.json
3. 检查上游API文档是否有变更
4. 临时: 跳过损坏记录继续处理
5. 联系上游团队确认数据格式`,
        status: 'resolved'
      },
      {
        taskName: 'payment-gateway-webhook',
        errorMessage: 'Error: connect ECONNREFUSED 10.0.0.100:443',
        stackTrace: `Error: connect ECONNREFUSED 10.0.0.100:443
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1144:16)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
    at async sendWebhook (/app/src/services/webhook.js:45:18)`,
        context: { endpoint: 'https://partner-payment.example.com/webhook', retries: 3 },
        notes: '第三方支付网关服务不可用',
        resolution: `处理步骤：
1. 检查网络连通性: ping 10.0.0.100
2. 测试端口: telnet 10.0.0.100 443
3. 查看第三方服务状态页
4. 临时: 启用队列缓冲，等待服务恢复
5. 联系第三方技术支持确认`,
        status: 'resolved'
      }
    ];

    let count = 0;
    samples.forEach(sample => {
      const { isNew } = store.addOrUpdate(sample);
      if (isNew) count++;
    });

    console.log(chalk.green(`✓ 已导入 ${count} 个示例条目`));
    console.log(chalk.gray('示例包含:'));
    console.log(chalk.gray('  - 数据库超时 (Connection timeout)'));
    console.log(chalk.gray('  - 权限缺失 (AccessDenied)'));
    console.log(chalk.gray('  - 数据格式错误 (Invalid JSON)'));
    console.log(chalk.gray('  - 外部依赖失败 (ECONNREFUSED)'));
    console.log(chalk.yellow('\n尝试运行: failure-kb suggest -t daily-report-generator -m "timeout"'));
  });

program.parse(process.argv);
