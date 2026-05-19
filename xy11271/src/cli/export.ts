#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import * as path from "path";
import "reflect-metadata";
import { initDatabase } from "../config/database";
import { ExportService } from "../services/ExportService";

const program = new Command();

program
  .name("quality-export")
  .description("导出质检数据")
  .version("1.0.0");

program
  .command("transcripts")
  .description("导出通话记录")
  .option("-o, --output <path>", "输出文件路径")
  .option("-s, --status <status>", "过滤状态: pending/processed/reviewed")
  .action(async (options) => {
    try {
      await initDatabase();
      const exportService = new ExportService();

      const outputPath = options.output || path.join(process.cwd(), "data", "exports", `transcripts_${Date.now()}.csv`);

      console.log(chalk.blue(`正在导出通话记录到: ${outputPath}`));
      const filter: any = {};
      if (options.status) {
        filter.status = options.status;
      }

      const result = await exportService.exportTranscriptsToCsv(filter, outputPath);

      console.log(chalk.green(`导出成功: ${result}`));
    } catch (error: any) {
      console.error(chalk.red(`导出失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("issues")
  .description("导出质检问题")
  .option("-o, --output <path>", "输出文件路径")
  .option("-s, --status <status>", "过滤状态: open/confirmed/false_positive")
  .action(async (options) => {
    try {
      await initDatabase();
      const exportService = new ExportService();

      console.log(chalk.blue("正在导出质检问题..."));
      const result = await exportService.exportIssuesToCsv(options.status, options.output);

      console.log(chalk.green(`导出成功: ${result}`));
    } catch (error: any) {
      console.error(chalk.red(`导出失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("reviews")
  .description("导出复核记录")
  .option("-o, --output <path>", "输出文件路径")
  .action(async (options) => {
    try {
      await initDatabase();
      const exportService = new ExportService();

      console.log(chalk.blue("正在导出复核记录..."));
      const result = await exportService.exportReviewsToCsv(options.output);

      console.log(chalk.green(`导出成功: ${result}`));
    } catch (error: any) {
      console.error(chalk.red(`导出失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("stats")
  .description("导出统计数据")
  .option("-o, --output <path>", "输出文件路径")
  .action(async (options) => {
    try {
      await initDatabase();
      const exportService = new ExportService();

      console.log(chalk.blue("正在导出统计数据..."));
      const result = await exportService.exportStatisticsToJson(options.output);

      console.log(chalk.green(`导出成功: ${result}`));
    } catch (error: any) {
      console.error(chalk.red(`导出失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("all")
  .description("导出全部数据")
  .option("-d, --dir <path>", "输出目录")
  .action(async (options) => {
    try {
      await initDatabase();
      const exportService = new ExportService();

      console.log(chalk.blue("正在导出全部数据..."));
      const result = await exportService.generateFullExport(options.dir);

      console.log(chalk.green("\n导出完成!"));
      console.log(chalk.cyan(`通话记录: ${result.transcripts}`));
      console.log(chalk.cyan(`质检问题: ${result.issues}`));
      console.log(chalk.cyan(`复核记录: ${result.reviews}`));
      console.log(chalk.cyan(`统计数据: ${result.statistics}`));
    } catch (error: any) {
      console.error(chalk.red(`导出失败: ${error.message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
