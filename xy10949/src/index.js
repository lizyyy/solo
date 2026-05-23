#!/usr/bin/env node
import { Command, Option } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { parseCSV } from './parsers/csv.js';
import { parseICS } from './parsers/ics.js';
import { groupByRoom, detectConflicts, mergeContiguousBookings, separateLockBookings } from './utils/processor.js';
import { printSummary, printError, printInfo } from './output/terminal.js';
import { generateJSON } from './output/json.js';
import { generateMarkdown } from './output/markdown.js';

const program = new Command();

program
  .name('homestay-import')
  .description('民宿房态导入工具 - 合并多平台房态日历，检测冲突，保留锁房')
  .version('1.0.0');

program
  .argument('<files...>', '输入文件路径 (CSV或ICS格式)')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('--name <name>', '输出文件名前缀', 'calendar')
  .addOption(new Option('-p, --platform <names...>', '平台名称，按输入文件顺序').default(['airbnb', 'tujia', 'xiecheng']))
  .option('--no-json', '不生成JSON输出')
  .option('--no-markdown', '不生成Markdown报告')
  .option('--no-summary', '不显示终端摘要')
  .action(async (files, options) => {
    try {
      const outputDir = resolve(options.output);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const allBookings = [];
      const allErrors = [];
      const sources = [];

      for (let i = 0; i < files.length; i++) {
        const filePath = resolve(files[i]);
        const platform = options.platform[i] || `platform${i + 1}`;

        if (!existsSync(filePath)) {
          printError(`文件不存在: ${filePath}`);
          process.exit(1);
        }

        printInfo(`正在解析: ${filePath} (${platform})`);

        let result;
        if (filePath.toLowerCase().endsWith('.csv')) {
          result = parseCSV(filePath, { platform });
        } else if (filePath.toLowerCase().endsWith('.ics')) {
          result = parseICS(filePath, { platform });
        } else {
          printError(`不支持的文件格式: ${filePath}`);
          process.exit(1);
        }

        allBookings.push(...result.bookings);
        allErrors.push(...result.errors);
        sources.push({
          filePath,
          platform,
          rowCount: result.rowCount
        });
      }

      const invalidRecords = allBookings.filter(b => b.hasErrors);
      const validBookings = allBookings.filter(b => !b.hasErrors);

      printInfo(`解析完成: ${validBookings.length} 条有效, ${invalidRecords.length} 条无效`);

      const byRoom = groupByRoom(validBookings);
      const conflicts = detectConflicts(byRoom);
      const merged = mergeContiguousBookings(byRoom);
      const { lockBookings, regularBookings } = separateLockBookings(merged);

      const totalMerged = Object.values(regularBookings).reduce((sum, arr) => sum + arr.length, 0);
      const totalLocks = Object.values(lockBookings).reduce((sum, arr) => sum + arr.length, 0);

      const result = {
        sources,
        stats: {
          totalRooms: Object.keys(byRoom).length,
          validBookings: validBookings.length,
          invalidRecords: invalidRecords.length,
          mergedBookings: totalMerged,
          lockBookings: totalLocks
        },
        errors: allErrors,
        conflicts,
        bookingsByRoom: byRoom,
        mergedBookings: regularBookings,
        lockBookings,
        invalidRecords
      };

      if (options.summary) {
        printSummary(result);
      }

      const baseName = join(outputDir, options.name);

      if (options.json) {
        const jsonPath = `${baseName}.json`;
        generateJSON(result, jsonPath);
        printInfo(`JSON结果已保存到: ${jsonPath}`);
      }

      if (options.markdown) {
        const mdPath = `${baseName}.md`;
        generateMarkdown(result, mdPath);
        printInfo(`Markdown报告已保存到: ${mdPath}`);
      }

    } catch (error) {
      printError(error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('help', { isDefault: false })
  .description('显示帮助信息')
  .action(() => {
    program.help();
  });

program.parse();
