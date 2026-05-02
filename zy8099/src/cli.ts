#!/usr/bin/env node

import { Command } from 'commander';
import { parseAndValidate } from './parser';
import { processTimeline } from './clockAligner';
import { applyQualityRules } from './qualityRules';
import { buildCallReport, exportAll } from './reportExporter';

const program = new Command();

program
  .name('webrtc-review')
  .description('WebRTC 通话质量复盘工具')
  .version('1.0.0')
  .option('--stats <path>', 'WebRTC 统计数据文件 (JSONL)')
  .option('--signaling <path>', '信令事件文件 (JSONL)')
  .option('--rules <path>', '质量规则文件 (YAML)')
  .option('--output <dir>', '输出目录', 'output')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    if (!options.stats || !options.signaling || !options.rules) {
      console.error('错误: 必须提供 --stats, --signaling 和 --rules 参数');
      program.help();
      process.exit(1);
    }

    console.log('正在解析和验证输入文件...');
    const { webrtcStats, signalingEvents, rules } = parseAndValidate(
      options.stats,
      options.signaling,
      options.rules
    );
    console.log(`  - 解析到 ${webrtcStats.length} 条 WebRTC 统计数据`);
    console.log(`  - 解析到 ${signalingEvents.length} 条信令事件`);
    console.log(`  - 解析到 ${rules.length} 条质量规则`);

    console.log('\n正在处理时间线...');
    const timeline = processTimeline(webrtcStats, signalingEvents);
    console.log(`  - 时间线包含 ${timeline.events.length} 个事件`);
    console.log(`  - 通话时长: ${(timeline.duration / 1000).toFixed(2)} 秒`);

    console.log('\n正在应用质量规则...');
    const qualityEvents = applyQualityRules(
      webrtcStats,
      signalingEvents,
      timeline,
      rules
    );
    console.log(`  - 检测到 ${qualityEvents.length} 个质量事件`);

    console.log('\n正在构建报告...');
    const report = buildCallReport(qualityEvents, timeline, webrtcStats, signalingEvents);

    console.log('\n正在导出报告...');
    exportAll(report, timeline, qualityEvents, options.output);
    console.log(`  - 报告已导出到目录: ${options.output}`);
    console.log('    - call_report.md (Markdown 报告)');
    console.log('    - quality_events.csv (质量事件 CSV)');
    console.log('    - timeline.html (可交互时间线 HTML)');

    console.log('\n完成!');
  } catch (error) {
    console.error('错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
