#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketLogParser } from './parser';
import { ReplayEngine } from './replay-engine';
import { ReportGenerator } from './report-generator';

const program = new Command();

program
  .name('ws-replay')
  .description('WebSocket 会话回放与异常定位工具')
  .version('1.0.0');

program
  .command('replay')
  .description('回放 WebSocket 会话日志')
  .argument('<logFile>', 'WebSocket 日志文件路径')
  .option('-c, --connection <id>', '按连接 ID 过滤')
  .option('-o, --output <dir>', '输出报告目录', './reports')
  .option('--html', '生成 HTML 报告')
  .option('--json', '生成 JSON 报告')
  .option('--no-terminal', '不输出终端报告')
  .action(async (logFile: string, options) => {
    try {
      if (!fs.existsSync(logFile)) {
        console.error(`错误: 文件不存在: ${logFile}`);
        process.exit(1);
      }

      const parser = new WebSocketLogParser();
      console.log(`正在解析日志文件: ${logFile}...`);
      const frames = await parser.parseFile(logFile);

      let filteredFrames = frames;
      if (options.connection) {
        filteredFrames = parser.filterByConnection(frames, options.connection);
        console.log(`已按连接 ID 过滤，剩余 ${filteredFrames.length} 帧`);
      }

      console.log(`解析完成，共 ${frames.length} 帧，有效 ${frames.filter(f => f.isValid).length} 帧`);

      const engine = new ReplayEngine();
      const result = engine.replay(filteredFrames, logFile);

      const generator = new ReportGenerator();
      const reports = generator.generate(result);

      if (options.terminal !== false) {
        console.log(reports.terminal);
      }

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      const baseName = path.basename(logFile, path.extname(logFile));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (options.json) {
        const jsonPath = path.join(options.output, `${baseName}-${timestamp}.json`);
        fs.writeFileSync(jsonPath, reports.machineReadable, 'utf-8');
        console.log(`JSON 报告已保存: ${jsonPath}`);
      }

      if (options.html) {
        const htmlPath = path.join(options.output, `${baseName}-${timestamp}.html`);
        fs.writeFileSync(htmlPath, reports.html, 'utf-8');
        console.log(`HTML 报告已保存: ${htmlPath}`);
      }

      if (!options.html && !options.json && options.terminal !== false) {
        const jsonPath = path.join(options.output, `${baseName}-${timestamp}.json`);
        fs.writeFileSync(jsonPath, reports.machineReadable, 'utf-8');
        console.log(`完整数据已保存: ${jsonPath}`);
      }

    } catch (error) {
      console.error('执行失败:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出日志中的连接信息')
  .argument('<logFile>', 'WebSocket 日志文件路径')
  .action(async (logFile: string) => {
    try {
      if (!fs.existsSync(logFile)) {
        console.error(`错误: 文件不存在: ${logFile}`);
        process.exit(1);
      }

      const parser = new WebSocketLogParser();
      const frames = await parser.parseFile(logFile);
      const connectionIds = parser.getConnectionIds(frames);

      console.log('\n发现的连接 ID:');
      if (connectionIds.length === 0) {
        console.log('  (无有效连接 ID)');
      } else {
        connectionIds.forEach((id, index) => {
          const count = frames.filter(f => f.connectionId === id).length;
          console.log(`  ${index + 1}. ${id} (${count} 帧)`);
        });
      }
      console.log('');

    } catch (error) {
      console.error('执行失败:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('inspect')
  .description('查看特定帧的详细信息')
  .argument('<logFile>', 'WebSocket 日志文件路径')
  .option('-n, --number <n>', '帧的行号', parseInt)
  .option('-i, --index <i>', '帧的索引（按时间排序后）', parseInt)
  .action(async (logFile: string, options) => {
    try {
      if (!fs.existsSync(logFile)) {
        console.error(`错误: 文件不存在: ${logFile}`);
        process.exit(1);
      }

      const parser = new WebSocketLogParser();
      const frames = await parser.parseFile(logFile);

      let targetFrame;
      if (options.number !== undefined) {
        targetFrame = frames.find(f => f.lineNumber === options.number);
        if (!targetFrame) {
          console.log(`未找到行号为 ${options.number} 的帧`);
          return;
        }
      } else if (options.index !== undefined) {
        const sorted = parser.sortFramesByTime(frames);
        if (options.index >= 0 && options.index < sorted.length) {
          targetFrame = sorted[options.index];
        } else {
          console.log(`索引 ${options.index} 超出范围，有效范围 0-${sorted.length - 1}`);
          return;
        }
      } else {
        console.log('请指定 --number 或 --index 参数');
        return;
      }

      console.log('\n帧详细信息:');
      console.log('='.repeat(60));
      console.log(`行号: ${targetFrame.lineNumber}`);
      console.log(`时间: ${new Date(targetFrame.timestamp).toISOString()}`);
      console.log(`连接 ID: ${targetFrame.connectionId}`);
      console.log(`方向: ${targetFrame.direction}`);
      console.log(`Opcode: ${targetFrame.opcode}`);
      console.log(`是否有效: ${targetFrame.isValid ? '是' : '否'}`);
      if (!targetFrame.isValid) {
        console.log(`解析错误: ${targetFrame.parseError}`);
      }
      console.log('\nPayload:');
      console.log(targetFrame.payload);
      console.log('\n原始内容:');
      console.log(targetFrame.raw);
      console.log('');

    } catch (error) {
      console.error('执行失败:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证解析器和边界情况')
  .action(async () => {
    try {
      const { runSelfTest } = await import('./self-test');
      await runSelfTest();
    } catch (error) {
      console.error('自检失败:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
