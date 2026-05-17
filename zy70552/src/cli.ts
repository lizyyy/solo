#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
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
  .option("--no-verify-rollback", "跳过回滚校验")
  .option("--preserve-failed-state", "失败时保留数据库现场，不清理")
  .option("--run-id <string>", "指定运行ID，用于覆盖旧结果")
  .option("--fail-fast", "遇到第一个失败时立即停止")
  .action(async (options) => {
    try {
      const configPath = path.resolve(options.dbConfig);
      if (!fs.existsSync(configPath)) {
        throw new Error(`Database config file not found: ${configPath}`);
      }
      const configContent = fs.readFileSync(configPath, "utf-8");
      const dbConfig = JSON.parse(configContent);
      
      const executor = new ReplayExecutor({ 
        migrationScriptsPath: options.migrations, 
        shadowDataPath: options.shadowData, 
        tableSchemasPath: options.schemas, 
        outputDir: options.output, 
        databaseConfig: dbConfig,
        verifyRollback: options.verifyRollback,
        preserveFailedState: options.preserveFailedState,
        failFast: options.failFast,
        runId: options.runId
      });
      
      const report = await executor.execute();
      process.exit(report.summary.failedScripts > 0 ? 1 : 0);
    } catch (error: any) {
      console.error(chalk.red("\n错误: " + error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);