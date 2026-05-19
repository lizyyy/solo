#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import "reflect-metadata";
import { initDatabase } from "../config/database";
import { ImportService } from "../services/ImportService";

const program = new Command();

program
  .name("quality-import")
  .description("导入客服质检数据")
  .version("1.0.0");

program
  .command("transcript")
  .description("导入转写文本文件")
  .argument("<file>", "转写文本文件路径")
  .action(async (file: string) => {
    try {
      await initDatabase();
      const importService = new ImportService();

      console.log(chalk.blue(`正在导入转写文件: ${file}`));
      const result = await importService.importTranscripts(file);

      console.log(chalk.green("\n导入完成!"));
      console.log(chalk.cyan(`批次号: ${result.batchNumber}`));
      console.log(chalk.cyan(`总记录数: ${result.total}`));
      console.log(chalk.green(`成功: ${result.success}`));
      console.log(chalk.red(`失败: ${result.failed}`));

      if (result.errors.length > 0) {
        console.log(chalk.yellow("\n错误详情:"));
        result.errors.forEach((error, index) => {
          console.log(chalk.yellow(`  ${index + 1}. 第 ${error.lineNumber} 行: ${error.message}`));
          if (error.originalContent) {
            console.log(chalk.gray(`     原始内容: ${error.originalContent}`));
          }
          if (error.suggestion) {
            console.log(chalk.magenta(`     建议: ${error.suggestion}`));
          }
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("metadata")
  .description("导入通话元数据CSV文件")
  .argument("<file>", "CSV文件路径")
  .action(async (file: string) => {
    try {
      await initDatabase();
      const importService = new ImportService();

      console.log(chalk.blue(`正在导入元数据文件: ${file}`));
      const result = await importService.importMetadata(file);

      console.log(chalk.green("\n导入完成!"));
      console.log(chalk.cyan(`批次号: ${result.batchNumber}`));
      console.log(chalk.cyan(`总记录数: ${result.total}`));
      console.log(chalk.green(`成功: ${result.success}`));
      console.log(chalk.red(`失败: ${result.failed}`));

      if (result.errors.length > 0) {
        console.log(chalk.yellow("\n错误详情:"));
        result.errors.forEach((error, index) => {
          console.log(chalk.yellow(`  ${index + 1}. 第 ${error.lineNumber} 行: ${error.message}`));
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("sensitive")
  .description("导入敏感词列表")
  .argument("<file>", "敏感词文件路径")
  .action(async (file: string) => {
    try {
      await initDatabase();
      const importService = new ImportService();

      console.log(chalk.blue(`正在导入敏感词文件: ${file}`));
      const result = await importService.importSensitiveWords(file);

      console.log(chalk.green("\n导入完成!"));
      console.log(chalk.cyan(`批次号: ${result.batchNumber}`));
      console.log(chalk.cyan(`总记录数: ${result.total}`));
      console.log(chalk.green(`成功: ${result.success}`));
      console.log(chalk.red(`失败: ${result.failed}`));
    } catch (error: any) {
      console.error(chalk.red(`导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("batch <batchId>")
  .description("查看导入批次详情")
  .action(async (batchId: string) => {
    try {
      await initDatabase();
      const importService = new ImportService();

      const batch = await importService.getBatchInfo(batchId);
      if (!batch) {
        console.log(chalk.red("批次不存在"));
        return;
      }

      console.log(chalk.cyan(`\n批次号: ${batch.batchNumber}`));
      console.log(chalk.cyan(`来源类型: ${batch.sourceType}`));
      console.log(chalk.cyan(`状态: ${batch.status}`));
      console.log(chalk.cyan(`总记录: ${batch.totalRecords}`));
      console.log(chalk.green(`成功: ${batch.successCount}`));
      console.log(chalk.red(`失败: ${batch.failedCount}`));

      if (batch.errors.length > 0) {
        console.log(chalk.yellow("\n错误记录:"));
        batch.errors.forEach((error, index) => {
          console.log(
            chalk.yellow(
              `  ${index + 1}. 行 ${error.lineNumber}: ${error.message} [${
                error.resolved ? "已处理" : "未处理"
              }]`
            )
          );
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`查询失败: ${error.message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
