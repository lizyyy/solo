#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DiagnosticService } from '../services';
import { ParserType } from '../parsers';
import { ReportOptions } from '../types';
import { formatTimestamp, formatDuration } from '../utils';

const program = new Command();
const service = new DiagnosticService();

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  critical: (text: string) => chalk.red(text),
  high: (text: string) => chalk.yellowBright(text),
  medium: (text: string) => chalk.yellow(text),
  low: (text: string) => chalk.green(text)
};

program
  .name('webrtc-diagnose')
  .description('通话卡顿回放台 - WebRTC 日志诊断工具')
  .version('1.0.0');

program
  .command('analyze')
  .description('分析一个或多个 WebRTC 日志文件')
  .argument('<files...>', '要分析的日志文件路径')
  .option('-n, --name <name>', '会话名称')
  .option('-t, --type <type>', '指定文件类型 (getstats|signaling|usernote|auto)', 'auto')
  .option('--types <types...>', '为每个文件单独指定类型 (如: getstats signaling usernote)')
  .option('--save', '保存会话到历史记录')
  .option('-o, --output <path>', '输出报告文件路径 (支持 .json 或 .md)')
  .option('--format <format>', '输出格式 (json|markdown|console)', 'console')
  .option('--include-evidence', '在报告中包含详细证据数据')
  .option('--packet-loss-threshold <number>', '丢包率告警阈值 (%)', '5')
  .option('--jitter-threshold <number>', '抖动告警阈值 (ms)', '500')
  .option('--bitrate-drop-ratio <number>', '码率突降比例 (0-1)', '0.5')
  .action(async (files: string[], options: {
    name?: string;
    type?: string;
    types?: string[];
    save?: boolean;
    output?: string;
    format?: string;
    includeEvidence?: boolean;
    packetLossThreshold?: string;
    jitterThreshold?: string;
    bitrateDropRatio?: string;
  }) => {
    try {
      console.log(chalk.blue('\n🔍 通话卡顿回放台 - WebRTC 日志诊断工具\n'));
      
      const filesWithTypes = prepareFilesWithTypes(files, options.type || 'auto', options.types);
      
      console.log(chalk.gray(`解析 ${files.length} 个日志文件...\n`));

      const ruleOptions = {
        packetLossThreshold: parseFloat(options.packetLossThreshold || '5'),
        jitterThreshold: parseFloat(options.jitterThreshold || '500'),
        bitrateDropRatio: parseFloat(options.bitrateDropRatio || '0.5')
      };

      const result = await service.analyzeFiles(filesWithTypes, {
        sessionName: options.name,
        ruleOptions
      });

      const session = result.session;

      printSessionSummary(session);

      if (options.format === 'console' || options.format === undefined) {
        printAnomalySummary(session);
        printStutterSegments(session);
      }

      if (options.save) {
        const savedSession = await service.saveSession(session);
        console.log(chalk.green(`\n✅ 会话已保存: ${savedSession.id}`));
      }

      if (options.output) {
        const reportOptions: ReportOptions = {
          format: options.output.endsWith('.json') ? 'json' : 'markdown',
          includeRawData: false,
          includeEvidence: options.includeEvidence || false
        };

        if (options.output.endsWith('.json')) {
          await service.exportJsonReport(session, options.output, reportOptions);
          console.log(chalk.green(`\n✅ JSON 报告已保存: ${options.output}`));
        } else {
          await service.exportMarkdownReport(session, options.output, reportOptions);
          console.log(chalk.green(`\n✅ Markdown 报告已保存: ${options.output}`));
        }
      }

      if (options.format === 'json') {
        const reportOptions: ReportOptions = {
          format: 'json',
          includeRawData: false,
          includeEvidence: options.includeEvidence || false
        };
        console.log(service.exportJsonReportToString(session, reportOptions));
      } else if (options.format === 'markdown') {
        const reportOptions: ReportOptions = {
          format: 'markdown',
          includeRawData: false,
          includeEvidence: options.includeEvidence || false
        };
        console.log(service.exportMarkdownReportToString(session, reportOptions));
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ 分析失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出所有历史会话')
  .option('-l, --limit <number>', '限制显示数量')
  .option('-s, --short', '简洁显示模式')
  .action(async (options: {
    limit?: string;
    short?: boolean;
  }) => {
    try {
      const sessions = await service.listSessions();
      
      if (sessions.length === 0) {
        console.log(chalk.yellow('\n📭 暂无历史会话\n'));
        return;
      }

      const limit = options.limit ? parseInt(options.limit, 10) : sessions.length;
      const displaySessions = sessions.slice(0, limit);

      console.log(chalk.blue(`\n📋 历史会话 (共 ${sessions.length} 个)\n`));

      if (options.short) {
        for (const session of displaySessions) {
          const qualityColor = session.callQualityScore >= 80 ? chalk.green : 
                               session.callQualityScore >= 60 ? chalk.yellow : chalk.red;
          console.log(`${chalk.gray(session.id)} | ${session.name} | ${qualityColor(`评分: ${session.callQualityScore}/100`)}`);
        }
      } else {
        for (let i = 0; i < displaySessions.length; i++) {
          const session = displaySessions[i];
          const qualityColor = session.callQualityScore >= 80 ? chalk.green : 
                               session.callQualityScore >= 60 ? chalk.yellow : chalk.red;
          
          console.log(chalk.cyan(`\n--- 会话 ${i + 1} ---`));
          console.log(`  ID: ${chalk.gray(session.id)}`);
          console.log(`  名称: ${session.name}`);
          console.log(`  通话质量: ${qualityColor(session.callQualityScore + '/100')}`);
          console.log(`  总时长: ${formatDuration(session.totalDuration)}`);
          console.log(`  卡顿占比: ${session.stutterPercentage.toFixed(1)}%`);
          console.log(`  更新时间: ${formatTimestamp(session.updatedAt)}`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error(chalk.red(`\n❌ 操作失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('show')
  .description('显示指定会话的详细信息')
  .argument('<sessionId>', '会话 ID')
  .option('-o, --output <path>', '导出报告到文件')
  .option('--format <format>', '输出格式 (json|markdown|console)', 'console')
  .option('--include-evidence', '包含详细证据数据')
  .action(async (sessionId: string, options: {
    output?: string;
    format?: string;
    includeEvidence?: boolean;
  }) => {
    try {
      const session = await service.getSession(sessionId);
      
      if (!session) {
        console.log(chalk.red(`\n❌ 找不到会话: ${sessionId}\n`));
        process.exit(1);
        return;
      }

      if (options.format === 'console' || options.format === undefined) {
        console.log(chalk.blue(`\n📊 会话详情: ${session.name}\n`));
        printSessionSummary(session);
        printAnomalySummary(session);
        printStutterSegments(session);
      }

      if (options.output) {
        const reportOptions: ReportOptions = {
          format: options.output.endsWith('.json') ? 'json' : 'markdown',
          includeRawData: false,
          includeEvidence: options.includeEvidence || false
        };

        if (options.output.endsWith('.json')) {
          await service.exportJsonReport(session, options.output, reportOptions);
          console.log(chalk.green(`\n✅ JSON 报告已保存: ${options.output}`));
        } else {
          await service.exportMarkdownReport(session, options.output, reportOptions);
          console.log(chalk.green(`\n✅ Markdown 报告已保存: ${options.output}`));
        }
      }

      if (options.format === 'json') {
        const reportOptions: ReportOptions = {
          format: 'json',
          includeRawData: false,
          includeEvidence: options.includeEvidence || false
        };
        console.log(service.exportJsonReportToString(session, reportOptions));
      } else if (options.format === 'markdown') {
        const reportOptions: ReportOptions = {
          format: 'markdown',
          includeRawData: false,
          includeEvidence: options.includeEvidence || false
        };
        console.log(service.exportMarkdownReportToString(session, reportOptions));
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ 操作失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('delete')
  .description('删除指定会话')
  .argument('<sessionId>', '会话 ID')
  .option('-f, --force', '强制删除，不确认')
  .action(async (sessionId: string) => {
    try {
      const session = await service.getSession(sessionId);
      
      if (!session) {
        console.log(chalk.red(`\n❌ 找不到会话: ${sessionId}\n`));
        process.exit(1);
        return;
      }

      const deleted = await service.deleteSession(sessionId);
      
      if (deleted) {
        console.log(chalk.green(`\n✅ 会话已删除: ${session.name} (${sessionId})\n`));
      } else {
        console.log(chalk.red(`\n❌ 删除失败\n`));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ 操作失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出会话报告')
  .argument('<sessionId>', '会话 ID')
  .argument('<outputPath>', '输出文件路径')
  .option('--include-evidence', '包含详细证据数据')
  .action(async (sessionId: string, outputPath: string, options: {
    includeEvidence?: boolean;
  }) => {
    try {
      const session = await service.getSession(sessionId);
      
      if (!session) {
        console.log(chalk.red(`\n❌ 找不到会话: ${sessionId}\n`));
        process.exit(1);
        return;
      }

      const reportOptions: ReportOptions = {
        format: outputPath.endsWith('.json') ? 'json' : 'markdown',
        includeRawData: false,
        includeEvidence: options.includeEvidence || false
      };

      if (outputPath.endsWith('.json')) {
        await service.exportJsonReport(session, outputPath, reportOptions);
        console.log(chalk.green(`\n✅ JSON 报告已保存: ${outputPath}`));
      } else {
        await service.exportMarkdownReport(session, outputPath, reportOptions);
        console.log(chalk.green(`\n✅ Markdown 报告已保存: ${outputPath}`));
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ 操作失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('显示存储统计信息')
  .action(async () => {
    try {
      const stats = await service.getStorage().getStatistics();
      
      console.log(chalk.blue('\n📈 存储统计信息\n'));
      console.log(`  总会话数: ${stats.totalSessions}`);
      console.log(`  总通话时长: ${formatDuration(stats.totalDuration)}`);
      console.log(`  平均质量评分: ${stats.avgQualityScore.toFixed(1)}/100`);
      console.log(`  平均卡顿占比: ${stats.avgStutterPercentage.toFixed(1)}%`);
      
      if (stats.oldestSessionDate) {
        console.log(`  最早上次: ${formatTimestamp(stats.oldestSessionDate)}`);
      }
      if (stats.newestSessionDate) {
        console.log(`  最新会话: ${formatTimestamp(stats.newestSessionDate)}`);
      }
      
      console.log(`  数据目录: ${service.getStorage().getDataDir()}`);
      console.log('');

    } catch (error) {
      console.error(chalk.red(`\n❌ 操作失败: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

function prepareFilesWithTypes(
  files: string[],
  defaultType: string,
  specificTypes?: string[]
): Array<{ filePath: string; type?: ParserType }> {
  if (!specificTypes || specificTypes.length === 0) {
    return files.map(filePath => ({
      filePath,
      type: defaultType as ParserType
    }));
  }

  return files.map((filePath, index) => ({
    filePath,
    type: (specificTypes[index] || defaultType) as ParserType
  }));
}

function printSessionSummary(session: any): void {
  const qualityScore = session.metadata.callQualityScore;
  const qualityColor = qualityScore >= 80 ? chalk.green : 
                       qualityScore >= 60 ? chalk.yellow : chalk.red;
  const qualityEmoji = qualityScore >= 80 ? '🟢' : 
                       qualityScore >= 60 ? '🟡' : '🔴';

  console.log(`  ${qualityEmoji} 通话质量评分: ${qualityColor(qualityScore + '/100')}`);
  console.log(`  ⏱️  总时长: ${formatDuration(session.metadata.totalDuration)}`);
  console.log(`  📉 卡顿时长: ${formatDuration(session.metadata.stutterDuration)} (${session.metadata.stutterPercentage.toFixed(1)}%)`);
  console.log(`  📊 异常数量: ${session.anomalies.length}`);
  console.log(`  🎯 卡顿片段: ${session.stutters.length}`);
  console.log('');
}

function printAnomalySummary(session: any): void {
  if (session.anomalies.length === 0) {
    console.log(chalk.green('  ✅ 未检测到异常\n'));
    return;
  }

  console.log(chalk.cyan('  📈 异常统计:\n'));
  
  const anomalyCounts: Record<string, { count: number; maxSeverity: string }> = {};
  
  for (const anomaly of session.anomalies) {
    if (!anomalyCounts[anomaly.type]) {
      anomalyCounts[anomaly.type] = { count: 0, maxSeverity: 'low' };
    }
    anomalyCounts[anomaly.type].count++;
    
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const current = severityOrder.indexOf(anomalyCounts[anomaly.type].maxSeverity);
    const newOne = severityOrder.indexOf(anomaly.severity);
    if (newOne > current) {
      anomalyCounts[anomaly.type].maxSeverity = anomaly.severity;
    }
  }

  const typeNames: Record<string, string> = {
    ice_reconnect: 'ICE 重连',
    bitrate_drop: '码率突降',
    packet_loss_high: '丢包率过高',
    jitter_high: '抖动过高',
    track_mute: '轨道静音',
    device_switch: '设备切换',
    signaling_break: '信令中断',
    audiovideo_desync: '音视频不同步',
    quality_limitation: '质量限制',
    frames_dropped: '丢帧',
    rtt_spike: 'RTT 尖峰'
  };

  for (const [type, info] of Object.entries(anomalyCounts)) {
    const colorFn = SEVERITY_COLORS[info.maxSeverity] || ((text: string) => chalk.gray(text));
    const name = typeNames[type] || type;
    console.log(`    ${colorFn(`${name}: ${info.count} 次`)}`);
  }
  console.log('');
}

function printStutterSegments(session: any): void {
  if (session.stutters.length === 0) {
    return;
  }

  console.log(chalk.cyan('  🔍 卡顿片段分析:\n'));

  const typeNames: Record<string, string> = {
    ice_reconnect: 'ICE 重连',
    bitrate_drop: '码率突降',
    packet_loss_high: '丢包率过高',
    jitter_high: '抖动过高',
    track_mute: '轨道静音',
    device_switch: '设备切换',
    signaling_break: '信令中断',
    audiovideo_desync: '音视频不同步',
    quality_limitation: '质量限制',
    frames_dropped: '丢帧',
    rtt_spike: 'RTT 尖峰'
  };

  for (let i = 0; i < session.stutters.length; i++) {
    const stutter = session.stutters[i];
    const causeName = typeNames[stutter.primaryCause] || stutter.primaryCause;
    const confidenceColor = stutter.confidence >= 80 ? chalk.green : 
                           stutter.confidence >= 60 ? chalk.yellow : chalk.red;

    console.log(`    🎬 片段 ${i + 1}:`);
    console.log(`       时间: ${formatTimestamp(stutter.startTime)}`);
    console.log(`       持续: ${formatDuration(stutter.duration)}`);
    console.log(`       主要原因: ${causeName}`);
    console.log(`       置信度: ${confidenceColor(stutter.confidence + '%')}`);
    console.log(`       用户影响: ${stutter.userImpact}`);
    console.log('');
  }
}

program.parse(process.argv);
