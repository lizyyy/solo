#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { LogParser } from './parser';
import { Aggregator } from './aggregator';
import { ConfigManager } from './configManager';
import { Reporter } from './reporter';
import { SamplingOptions, SuppressionRule } from './types';

const program = new Command();
const configManager = new ConfigManager();
const reporter = new Reporter();

function getDefaultSamplingOptions(): SamplingOptions {
  return {
    timeWindowMinutes: 60,
    minSampleCount: 1,
    maxSamples: 50,
    sortBy: 'priority',
    sortOrder: 'desc',
    includeSuppressed: false
  };
}

program
  .name('exception-sampler')
  .description('业务异常采样 CLI 工具 - 从海量异常日志中提取代表性样本')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描日志文件，分析日志结构和字段完整性')
  .argument('<logfile>', '日志文件路径')
  .option('-c, --config <path>', '业务字段配置文件')
  .action((logfile: string, options: { config?: string }) => {
    try {
      const parser = new LogParser(options.config);
      const entries = parser.parseLogFile(logfile);
      const result = parser.analyze(entries);
      reporter.printScanResult(result);
    } catch (error) {
      console.error(chalk.red(`错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('采样异常日志，生成代表性样本')
  .argument('<logfile>', '日志文件路径')
  .option('-c, --config <path>', '业务字段配置文件')
  .option('-t, --time-window <minutes>', '时间窗口大小（分钟）', '60')
  .option('-n, --max-samples <count>', '最大样本数量', '50')
  .option('--min-count <count>', '最小聚合数量', '1')
  .option('--sort-by <field>', '排序字段: amount|count|priority|time', 'priority')
  .option('--sort-order <order>', '排序方向: asc|desc', 'desc')
  .option('--include-suppressed', '包含已抑制的样本')
  .action((logfile: string, options: {
    config?: string;
    timeWindow: string;
    maxSamples: string;
    minCount: string;
    sortBy: string;
    sortOrder: string;
    includeSuppressed: boolean;
  }) => {
    try {
      const samplingOptions: SamplingOptions = {
        timeWindowMinutes: parseInt(options.timeWindow, 10),
        minSampleCount: parseInt(options.minCount, 10),
        maxSamples: parseInt(options.maxSamples, 10),
        sortBy: options.sortBy as SamplingOptions['sortBy'],
        sortOrder: options.sortOrder as SamplingOptions['sortOrder'],
        includeSuppressed: options.includeSuppressed
      };

      const parser = new LogParser(options.config);
      const entries = parser.parseLogFile(logfile);

      const errorCodeMapping = configManager.loadErrorCodeMapping();
      const suppressionRules = configManager.loadSuppressionRules();
      const knownErrorCodes = configManager.loadKnownErrorCodes();

      const aggregator = new Aggregator(errorCodeMapping, suppressionRules, knownErrorCodes);
      const samples = aggregator.aggregate(entries, samplingOptions);

      reporter.printSamples(samples);

      const newErrors = samples.filter(s => s.isNew && !s.isSuppressed);
      if (newErrors.length > 0) {
        newErrors.forEach(sample => {
          if (sample.errorCode !== 'UNKNOWN') {
            configManager.addKnownErrorCode(sample.errorCode);
          }
        });
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('explain')
  .description('解释某个样本的聚合详情')
  .argument('<logfile>', '日志文件路径')
  .argument('<sampleIndex>', '样本序号（从 sample 命令获取）')
  .option('-c, --config <path>', '业务字段配置文件')
  .option('-t, --time-window <minutes>', '时间窗口大小（分钟）', '60')
  .option('--min-count <count>', '最小聚合数量', '1')
  .action((logfile: string, sampleIndex: string, options: {
    config?: string;
    timeWindow: string;
    minCount: string;
  }) => {
    try {
      const samplingOptions: SamplingOptions = {
        ...getDefaultSamplingOptions(),
        timeWindowMinutes: parseInt(options.timeWindow, 10),
        minSampleCount: parseInt(options.minCount, 10),
        includeSuppressed: true
      };

      const parser = new LogParser(options.config);
      const entries = parser.parseLogFile(logfile);

      const errorCodeMapping = configManager.loadErrorCodeMapping();
      const suppressionRules = configManager.loadSuppressionRules();
      const knownErrorCodes = configManager.loadKnownErrorCodes();

      const aggregator = new Aggregator(errorCodeMapping, suppressionRules, knownErrorCodes);
      const samples = aggregator.aggregate(entries, samplingOptions);

      const index = parseInt(sampleIndex, 10) - 1;
      if (index >= 0 && index < samples.length) {
        reporter.printExplain(samples[index]);
      } else {
        console.error(chalk.red(`错误: 样本序号 ${sampleIndex} 不存在。有效范围: 1-${samples.length}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('suppress')
  .description('管理异常抑制规则')
  .argument('[action]', '操作: add|remove|list')
  .option('--pattern <pattern>', '错误码模式')
  .option('--tenant <pattern>', '租户ID模式')
  .option('--order <pattern>', '订单号模式')
  .option('--message <pattern>', '消息模式')
  .option('--min-amount <amount>', '最小金额')
  .option('--max-amount <amount>', '最大金额')
  .option('--expire <date>', '过期时间 (ISO格式，默认7天后)')
  .option('--reason <text>', '抑制原因')
  .option('--rule-id <id>', '规则ID (用于 remove)')
  .action((action: string | undefined, options: {
    pattern?: string;
    tenant?: string;
    order?: string;
    message?: string;
    minAmount?: string;
    maxAmount?: string;
    expire?: string;
    reason?: string;
    ruleId?: string;
  }) => {
    try {
      if (!action || action === 'list') {
        const rules = configManager.loadSuppressionRules();
        console.log('\n' + chalk.bold('═══════════════════════════════════════════'));
        console.log(chalk.bold(`           抑制规则列表 (${rules.length} 条)`));
        console.log(chalk.bold('═══════════════════════════════════════════\n'));
        
        if (rules.length === 0) {
          console.log(chalk.gray('  暂无抑制规则\n'));
        } else {
          rules.forEach((rule, index) => {
            console.log(`  ${index + 1}. ${chalk.bold(rule.id)}`);
            console.log(`     原因: ${rule.reason || '未指定'}`);
            console.log(`     过期: ${rule.expireAt}`);
            if (rule.errorCodePattern) console.log(`     错误码: ${rule.errorCodePattern}`);
            if (rule.tenantIdPattern) console.log(`     租户: ${rule.tenantIdPattern}`);
            if (rule.orderIdPattern) console.log(`     订单: ${rule.orderIdPattern}`);
            if (rule.messagePattern) console.log(`     消息: ${rule.messagePattern}`);
            console.log('');
          });
        }
        return;
      }

      if (action === 'add') {
        const defaultExpire = new Date();
        defaultExpire.setDate(defaultExpire.getDate() + 7);

        const ruleData: Omit<SuppressionRule, 'id'> = {
          pattern: options.pattern || '',
          errorCodePattern: options.pattern,
          tenantIdPattern: options.tenant,
          orderIdPattern: options.order,
          messagePattern: options.message,
          minAmount: options.minAmount ? parseFloat(options.minAmount) : undefined,
          maxAmount: options.maxAmount ? parseFloat(options.maxAmount) : undefined,
          expireAt: options.expire || defaultExpire.toISOString(),
          reason: options.reason || '手动抑制'
        };

        const newRule = configManager.addSuppressionRule(ruleData);
        console.log(chalk.green(`✓ 抑制规则已添加: ${newRule.id}`));
        console.log(`  过期时间: ${newRule.expireAt}`);
        console.log(`  原因: ${newRule.reason}`);
        return;
      }

      if (action === 'remove') {
        if (!options.ruleId) {
          console.error(chalk.red('错误: 请使用 --rule-id 指定要删除的规则ID'));
          process.exit(1);
        }
        
        const removed = configManager.removeSuppressionRule(options.ruleId);
        if (removed) {
          console.log(chalk.green(`✓ 规则已删除: ${options.ruleId}`));
        } else {
          console.error(chalk.red(`错误: 规则不存在: ${options.ruleId}`));
          process.exit(1);
        }
        return;
      }

      console.error(chalk.red(`错误: 未知操作 '${action}'。使用 add|remove|list`));
      process.exit(1);
    } catch (error) {
      console.error(chalk.red(`错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成综合分析报告')
  .argument('<logfile>', '日志文件路径')
  .option('-c, --config <path>', '业务字段配置文件')
  .option('-t, --time-window <minutes>', '时间窗口大小（分钟）', '60')
  .option('-n, --max-samples <count>', '最大样本数量', '50')
  .action((logfile: string, options: {
    config?: string;
    timeWindow: string;
    maxSamples: string;
  }) => {
    try {
      const samplingOptions: SamplingOptions = {
        ...getDefaultSamplingOptions(),
        timeWindowMinutes: parseInt(options.timeWindow, 10),
        maxSamples: parseInt(options.maxSamples, 10),
        includeSuppressed: true
      };

      const parser = new LogParser(options.config);
      const entries = parser.parseLogFile(logfile);
      const scanResult = parser.analyze(entries);

      const errorCodeMapping = configManager.loadErrorCodeMapping();
      const suppressionRules = configManager.loadSuppressionRules();
      const knownErrorCodes = configManager.loadKnownErrorCodes();

      const aggregator = new Aggregator(errorCodeMapping, suppressionRules, knownErrorCodes);
      const samples = aggregator.aggregate(entries, samplingOptions);

      reporter.printReport(samples, scanResult);

      const newErrors = samples.filter(s => s.isNew && !s.isSuppressed);
      if (newErrors.length > 0) {
        newErrors.forEach(sample => {
          if (sample.errorCode !== 'UNKNOWN') {
            configManager.addKnownErrorCode(sample.errorCode);
          }
        });
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(`错误: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
