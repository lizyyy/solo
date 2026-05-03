#!/usr/bin/env node

import * as path from 'path';
import * as chalk from 'chalk';
import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { MqttLogParser, YamlConfigParser } from '../parser';
import { ReplayEngine, ReplayOptions } from '../replay';
import { RuleEngine, RuleEngineOptions } from '../rules';
import { ReviewStorage, StorageOptions } from '../storage';
import { Exporter } from '../export';
import { AuditReport, ExportFormat, Violation } from '../types';

const program = new Command();

program
  .name('mqtt-auditor')
  .description('离线重连影子审计台 - 园区物联网运维MQTT设备影子回放器')
  .version('1.0.0');

program
  .command('import')
  .description('导入并校验MQTT日志和配置文件')
  .option('--log <path>', 'MQTT消息日志文件路径 (JSONL格式)')
  .option('--devices <path>', '设备配置文件路径 (YAML格式)')
  .option('--rules <path>', '告警规则文件路径 (YAML格式)')
  .action(async (options) => {
    console.log(chalk.blue('\n=== 开始导入数据 ===\n'));

    const mqttParser = new MqttLogParser();
    const yamlParser = new YamlConfigParser();

    let messageCount = 0;
    let messageErrors = 0;
    let deviceCount = 0;
    let deviceErrors = 0;
    let ruleCount = 0;
    let ruleErrors = 0;

    if (options.log) {
      console.log(chalk.gray(`正在解析日志文件: ${options.log}`));
      const result = await mqttParser.parseFile(options.log);
      messageCount = result.messages.length;
      messageErrors = result.errors.length;
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`  警告: ${result.errors.length} 条消息解析失败`));
        result.errors.slice(0, 5).forEach(err => {
          console.log(chalk.yellow(`    行 ${err.lineNumber}: ${err.error}`));
        });
      }
    }

    if (options.devices) {
      console.log(chalk.gray(`正在解析设备配置: ${options.devices}`));
      const result = await yamlParser.parseDeviceConfig(options.devices);
      deviceCount = result.devices.length;
      deviceErrors = result.errors.length;
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`  警告: ${result.errors.length} 个设备配置解析失败`));
      }
    }

    if (options.rules) {
      console.log(chalk.gray(`正在解析告警规则: ${options.rules}`));
      const result = await yamlParser.parseAlertRules(options.rules);
      ruleCount = result.rules.length;
      ruleErrors = result.errors.length;
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`  警告: ${result.errors.length} 个告警规则解析失败`));
      }
    }

    const validation = yamlParser.validateImport(
      { total: messageCount, errors: messageErrors },
      { total: deviceCount, errors: deviceErrors },
      { total: ruleCount, errors: ruleErrors }
    );

    console.log('\n' + chalk.blue('=== 导入结果 ==='));
    console.log(`  消息数: ${chalk.green(messageCount)}`);
    console.log(`  设备数: ${chalk.green(deviceCount)}`);
    console.log(`  规则数: ${chalk.green(ruleCount)}`);

    if (validation.warnings.length > 0) {
      console.log('\n' + chalk.yellow('警告:'));
      validation.warnings.forEach(w => console.log(`  - ${w}`));
    }

    if (validation.errors.length > 0) {
      console.log('\n' + chalk.red('错误:'));
      validation.errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    }

    console.log('\n' + chalk.green('导入完成!'));
  });

program
  .command('replay')
  .description('按时间轴模拟MQTT订阅/发布/retain/QoS处理')
  .option('--log <path>', 'MQTT消息日志文件路径', 'examples/mqtt-messages.jsonl')
  .option('--devices <path>', '设备配置文件路径', 'examples/device-config.yaml')
  .option('--rules <path>', '告警规则文件路径', 'examples/alert-rules.yaml')
  .option('--speed <number>', '回放速度倍数', '1')
  .option('--start <timestamp>', '开始时间戳')
  .option('--end <timestamp>', '结束时间戳')
  .action(async (options) => {
    console.log(chalk.blue('\n=== 开始回放 ===\n'));

    const mqttParser = new MqttLogParser();
    const yamlParser = new YamlConfigParser();

    console.log(chalk.gray('正在加载数据...'));
    const logResult = await mqttParser.parseFile(options.log);
    const devicesResult = await yamlParser.parseDeviceConfig(options.devices);
    const rulesResult = await yamlParser.parseAlertRules(options.rules);

    if (logResult.errors.length > 0) {
      console.log(chalk.yellow(`警告: ${logResult.errors.length} 条消息解析失败`));
    }

    console.log(`  消息数: ${logResult.messages.length}`);
    console.log(`  设备数: ${devicesResult.devices.length}`);
    console.log(`  规则数: ${rulesResult.rules.length}`);

    const replayOptions: ReplayOptions = {
      speed: parseFloat(options.speed),
      startTime: options.start ? parseInt(options.start, 10) : undefined,
      endTime: options.end ? parseInt(options.end, 10) : undefined
    };

    console.log('\n' + chalk.gray('开始回放...'));
    const replayEngine = new ReplayEngine(logResult.messages, replayOptions);
    const replayResult = await replayEngine.replay();

    console.log('\n' + chalk.blue('=== 回放结果 ==='));
    console.log(`  事件数: ${replayResult.events.length}`);
    console.log(`  保留消息数: ${replayResult.retainedMessages.size}`);
    console.log(`  会话数: ${replayResult.sessions.size}`);
    console.log(`  影子数: ${replayResult.deviceShadows.size}`);

    if (replayResult.retainedMessages.size > 0) {
      console.log('\n' + chalk.gray('保留消息列表:'));
      for (const [topic, msg] of replayResult.retainedMessages) {
        console.log(`  ${chalk.cyan(topic)}`);
        console.log(`    客户端: ${msg.clientId}`);
        console.log(`    QoS: ${msg.qos}`);
        console.log(`    时间: ${new Date(msg.timestamp).toISOString()}`);
      }
    }

    console.log('\n' + chalk.green('回放完成!'));
  });

program
  .command('check')
  .description('检测违规：版本倒退、重复命令、过期影子、告警漏发')
  .option('--log <path>', 'MQTT消息日志文件路径', 'examples/mqtt-messages.jsonl')
  .option('--devices <path>', '设备配置文件路径', 'examples/device-config.yaml')
  .option('--rules <path>', '告警规则文件路径', 'examples/alert-rules.yaml')
  .option('--expired-hours <number>', '影子过期阈值（小时）', '24')
  .option('--duplicate-window <number>', '重复检测窗口（毫秒）', '5000')
  .action(async (options) => {
    console.log(chalk.blue('\n=== 开始违规检测 ===\n'));

    const mqttParser = new MqttLogParser();
    const yamlParser = new YamlConfigParser();

    console.log(chalk.gray('正在加载数据...'));
    const logResult = await mqttParser.parseFile(options.log);
    const devicesResult = await yamlParser.parseDeviceConfig(options.devices);
    const rulesResult = await yamlParser.parseAlertRules(options.rules);

    const ruleEngineOptions: RuleEngineOptions = {
      expiredOptions: {
        maxAgeMs: parseFloat(options.expiredHours) * 60 * 60 * 1000
      },
      duplicateOptions: {
        windowMs: parseInt(options.duplicateWindow, 10)
      }
    };

    const replayEngine = new ReplayEngine(logResult.messages);
    const replayResult = await replayEngine.replay();
    const ruleEngine = new RuleEngine(ruleEngineOptions);

    console.log(chalk.gray('正在执行规则检测...'));

    const deviceConfigs = new Map(devicesResult.devices.map(d => [d.deviceId, d]));

    for (const message of logResult.messages) {
      const currentShadow = replayEngine.getShadowManager().getShadow(message.clientId);
      const existingRetained = replayEngine.getRetainedMessages().get(message.topic);
      const deviceConfig = deviceConfigs.get(message.clientId);

      ruleEngine.checkAll(message, {
        currentShadow,
        pendingMessages: [],
        currentTimestamp: message.timestamp,
        existingRetainedMessage: existingRetained,
        deviceConfig
      });
    }

    ruleEngine.processEvents(replayResult.events);

    const violations = ruleEngine.getAllViolations();
    const summary = ruleEngine.getSummary();

    console.log('\n' + chalk.blue('=== 违规检测结果 ==='));
    console.log(`  总违规数: ${violations.length}`);
    console.log(`  严重违规: ${summary.criticalCount}`);
    console.log(`  涉及设备数: ${summary.devicesWithViolations}`);

    if (Object.keys(summary.byType).length > 0) {
      console.log('\n  违规类型分布:');
      for (const [type, count] of Object.entries(summary.byType)) {
        const typeNames: Record<string, string> = {
          'version_regression': '版本倒退',
          'duplicate_command': '重复命令',
          'expired_shadow': '过期影子',
          'missed_alert': '告警漏发',
          'retain_override': 'Retain覆盖'
        };
        console.log(`    ${typeNames[type] || type}: ${count}`);
      }
    }

    if (violations.length > 0) {
      console.log('\n  违规详情:');
      
      const criticalViolations = violations.filter(v => v.severity === 'critical');
      const warningViolations = violations.filter(v => v.severity === 'warning');

      if (criticalViolations.length > 0) {
        console.log('\n    ' + chalk.red('严重违规:'));
        criticalViolations.slice(0, 5).forEach(v => {
          console.log(`      [${new Date(v.timestamp).toISOString()}]`);
          console.log(`      设备: ${v.deviceId || 'N/A'}`);
          console.log(`      消息: ${v.message}`);
        });
        if (criticalViolations.length > 5) {
          console.log(`      ... 还有 ${criticalViolations.length - 5} 条`);
        }
      }

      if (warningViolations.length > 0) {
        console.log('\n    ' + chalk.yellow('警告:'));
        warningViolations.slice(0, 3).forEach(v => {
          console.log(`      [${new Date(v.timestamp).toISOString()}] ${v.message}`);
        });
        if (warningViolations.length > 3) {
          console.log(`      ... 还有 ${warningViolations.length - 3} 条`);
        }
      }
    }

    console.log('\n' + chalk.green('检测完成!'));
  });

program
  .command('review')
  .description('保存人工裁决')
  .option('--violation-id <id>', '违规ID')
  .option('--decision <type>', '裁决类型: accept, reject, need_more_info')
  .option('--reason <text>', '裁决原因')
  .option('--reviewer <name>', '裁决人名称', 'system')
  .option('--data-dir <path>', '数据存储目录', 'data')
  .action((options) => {
    if (!options.violationId || !options.decision || !options.reason) {
      console.log(chalk.red('错误: 必须提供 --violation-id, --decision 和 --reason'));
      process.exit(1);
    }

    const validDecisions = ['accept', 'reject', 'need_more_info'];
    if (!validDecisions.includes(options.decision)) {
      console.log(chalk.red(`错误: 无效的裁决类型。有效值: ${validDecisions.join(', ')}`));
      process.exit(1);
    }

    const storage = new ReviewStorage({
      dataDir: path.resolve(options.dataDir)
    });

    const review = storage.createReview(
      options.violationId,
      options.decision as 'accept' | 'reject' | 'need_more_info',
      options.reason,
      options.reviewer
    );

    console.log(chalk.blue('\n=== 裁决已保存 ==='));
    console.log(`  裁决ID: ${review.id}`);
    console.log(`  违规ID: ${review.violationId}`);
    console.log(`  裁决: ${review.decision}`);
    console.log(`  原因: ${review.reason}`);
    console.log(`  裁决人: ${review.reviewer}`);
    console.log(`  时间: ${new Date(review.timestamp).toISOString()}`);

    console.log('\n' + chalk.green('裁决保存成功!'));
  });

program
  .command('report')
  .description('导出审计报告 (Markdown/CSV/JSON)')
  .option('--log <path>', 'MQTT消息日志文件路径', 'examples/mqtt-messages.jsonl')
  .option('--devices <path>', '设备配置文件路径', 'examples/device-config.yaml')
  .option('--rules <path>', '告警规则文件路径', 'examples/alert-rules.yaml')
  .option('--format <type>', '导出格式: markdown, csv, json', 'markdown')
  .option('--output <path>', '输出文件路径')
  .option('--no-details', '不包含详细信息')
  .option('--data-dir <path>', '数据存储目录', 'data')
  .action(async (options) => {
    console.log(chalk.blue('\n=== 生成审计报告 ===\n'));

    const validFormats: ExportFormat[] = ['markdown', 'csv', 'json'];
    const format = options.format as ExportFormat;
    if (!validFormats.includes(format)) {
      console.log(chalk.red(`错误: 无效的格式。有效值: ${validFormats.join(', ')}`));
      process.exit(1);
    }

    const mqttParser = new MqttLogParser();
    const yamlParser = new YamlConfigParser();
    const storage = new ReviewStorage({ dataDir: path.resolve(options.dataDir) });

    console.log(chalk.gray('正在加载数据...'));
    const logResult = await mqttParser.parseFile(options.log);
    const devicesResult = await yamlParser.parseDeviceConfig(options.devices);
    const rulesResult = await yamlParser.parseAlertRules(options.rules);

    const replayEngine = new ReplayEngine(logResult.messages);
    const replayResult = await replayEngine.replay();
    const ruleEngine = new RuleEngine();

    for (const message of logResult.messages) {
      const currentShadow = replayEngine.getShadowManager().getShadow(message.clientId);
      const existingRetained = replayEngine.getRetainedMessages().get(message.topic);
      const deviceConfig = devicesResult.devices.find(d => d.deviceId === message.clientId);

      ruleEngine.checkAll(message, {
        currentShadow,
        pendingMessages: [],
        currentTimestamp: message.timestamp,
        existingRetainedMessage: existingRetained,
        deviceConfig
      });
    }

    ruleEngine.processEvents(replayResult.events);

    const violations = ruleEngine.getAllViolations();
    const reviews = storage.getAllReviews();

    const startTime = logResult.messages[0]?.timestamp || Date.now();
    const endTime = logResult.messages[logResult.messages.length - 1]?.timestamp || Date.now();

    const retainedSummary = new Map<string, {
      topic: string;
      payload: string;
      version: number;
      lastUpdated: number;
    }>();

    let version = 1;
    for (const [topic, msg] of replayResult.retainedMessages) {
      retainedSummary.set(topic, {
        topic,
        payload: msg.payload,
        version: version++,
        lastUpdated: msg.timestamp
      });
    }

    const deviceStatuses = new Map(devicesResult.devices.map(d => [d.deviceId, d]));

    const report: AuditReport = {
      reportId: uuidv4(),
      generatedAt: Date.now(),
      period: {
        start: startTime,
        end: endTime
      },
      summary: {
        totalMessages: logResult.messages.length,
        totalDevices: devicesResult.devices.length,
        totalViolations: violations.length,
        violationsByType: ruleEngine.getSummary().byType,
        violationsBySeverity: ruleEngine.getSummary().bySeverity
      },
      violations,
      reviews,
      deviceStatuses,
      retainedMessages: retainedSummary
    };

    const exporter = new Exporter({
      format,
      includeDetails: options.details !== false,
      includeViolations: true,
      includeReviews: true,
      includeDeviceStatus: true
    });

    let outputPath = options.output;
    if (!outputPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = format === 'markdown' ? 'md' : format;
      outputPath = path.resolve(`report-${timestamp}.${ext}`);
    }

    exporter.exportToFile(report, outputPath);

    console.log(chalk.blue('\n=== 报告生成 ==='));
    console.log(`  报告ID: ${report.reportId}`);
    console.log(`  生成时间: ${new Date(report.generatedAt).toISOString()}`);
    console.log(`  格式: ${format}`);
    console.log(`  输出路径: ${outputPath}`);

    console.log('\n  报告摘要:');
    console.log(`    消息数: ${report.summary.totalMessages}`);
    console.log(`    设备数: ${report.summary.totalDevices}`);
    console.log(`    违规数: ${report.summary.totalViolations}`);
    console.log(`    裁决数: ${report.reviews.length}`);

    console.log('\n' + chalk.green('报告生成成功!'));
  });

program
  .command('list-reports')
  .description('列出已保存的报告')
  .option('--data-dir <path>', '数据存储目录', 'data')
  .action((options) => {
    const storage = new ReviewStorage({
      dataDir: path.resolve(options.dataDir)
    });

    const reports = storage.listReports();

    console.log(chalk.blue('\n=== 已保存的报告 ==='));
    
    if (reports.length === 0) {
      console.log(chalk.gray('  暂无报告'));
    } else {
      reports.forEach((report, index) => {
        console.log(`  ${index + 1}. ${report}`);
      });
    }

    const summary = storage.getSummary();
    console.log(`\n  总计: ${summary.totalReports} 个报告, ${summary.totalReviews} 条裁决`);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
