#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { ReplayExecutor } from "./replay-executor";
import { ReplayReport } from "./types";

const program = new Command();

program
  .name("sql-replay")
  .description("SQL迁移影子回放CLI - 在带历史数据的数据库上验证迁移脚本")
  .version("1.0.0");

program
  .command("run")
  .description("运行迁移回放")
  .requiredOption("-m, --migrations <path>", "迁移脚本路径")
  .requiredOption("-d, --shadow-data <path>", "影子数据路径")
  .requiredOption("-s, --schemas <path>", "表结构JSON路径")
  .requiredOption("-c, --db-config <path>", "数据库配置JSON路径")
  .requiredOption("-o, --output <dir>", "输出目录")
  .action(async (options) => {
    try {
      const dbConfig = require(options.dbConfig);
      const executor = new ReplayExecutor({ migrationScriptsPath: options.migrations, shadowDataPath: options.shadowData, tableSchemasPath: options.schemas, outputDir: options.output, databaseConfig: dbConfig });
      console.log(chalk.blue("\n=== SQL迁移影子回放开始 ===\n"));
      const report = await executor.execute();
      console.log(chalk.green("\n=== 回放完成 ===\n"));
      console.log(chalk.cyan("运行ID: " + report.runId));
      process.exit(report.summary.failedScripts > 0 ? 1 : 0);
    } catch (error: any) {
      console.error(chalk.red("\n错误: " + error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);