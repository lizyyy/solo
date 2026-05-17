#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
        const configPath = path.resolve(options.dbConfig);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Database config file not found: ${configPath}`);
        }
        const configContent = fs.readFileSync(configPath, "utf-8");
        const dbConfig = JSON.parse(configContent);
        const executor = new replay_executor_1.ReplayExecutor({
            migrationScriptsPath: options.migrations,
            shadowDataPath: options.shadowData,
            tableSchemasPath: options.schemas,
            outputDir: options.output,
            databaseConfig: dbConfig
        });
        const report = await executor.execute();
        process.exit(report.summary.failedScripts > 0 ? 1 : 0);
    }
    catch (error) {
        console.error(chalk_1.default.red("\n错误: " + error.message));
        process.exit(1);
    }
});
program.parse(process.argv);
