#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const replay_executor_1 = require("./replay-executor");
const program = new commander_1.Command();
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
        const executor = new replay_executor_1.ReplayExecutor({ migrationScriptsPath: options.migrations, shadowDataPath: options.shadowData, tableSchemasPath: options.schemas, outputDir: options.output, databaseConfig: dbConfig });
        console.log(chalk_1.default.blue("\n=== SQL迁移影子回放开始 ===\n"));
        const report = await executor.execute();
        console.log(chalk_1.default.green("\n=== 回放完成 ===\n"));
        console.log(chalk_1.default.cyan("运行ID: " + report.runId));
        process.exit(report.summary.failedScripts > 0 ? 1 : 0);
    }
    catch (error) {
        console.error(chalk_1.default.red("\n错误: " + error.message));
        process.exit(1);
    }
});
program.parse(process.argv);
