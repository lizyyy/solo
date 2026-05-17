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
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = __importStar(require("yargs"));
const chalk = require('chalk');
const processor_1 = require("./processor");
async function main() {
    const argv = await yargs
        .usage('$0 <input> [options]')
        .example('$0 ./data.jsonl --session sessionId --time timestamp', '处理单个 JSONL 文件')
        .example('$0 ./shards/ --session sessionId --time createdAt --shard shardId', '处理目录下所有 JSONL')
        .demandCommand(1, '请指定输入文件或目录')
        .option('session', {
        alias: 's',
        type: 'string',
        description: '会话键字段名',
        default: 'sessionId',
        demandOption: false
    })
        .option('time', {
        alias: 't',
        type: 'string',
        description: '事件时间字段名',
        default: 'timestamp',
        demandOption: false
    })
        .option('shard', {
        alias: 'sh',
        type: 'string',
        description: '分片编号字段名（可选）',
        demandOption: false
    })
        .option('gap-threshold', {
        alias: 'g',
        type: 'number',
        description: '缺口阈值（毫秒）',
        default: 5000,
        demandOption: false
    })
        .option('output-dir', {
        alias: 'o',
        type: 'string',
        description: '输出目录',
        default: './output',
        demandOption: false
    })
        .option('prefix', {
        alias: 'p',
        type: 'string',
        description: '输出文件前缀',
        default: '',
        demandOption: false
    })
        .help()
        .version()
        .argv;
    const options = {
        input: argv._[0],
        sessionKeyField: argv.session,
        eventTimeField: argv.time,
        shardIdField: argv.shard,
        gapThresholdMs: argv['gap-threshold'],
        outputDir: argv['output-dir'],
        outputPrefix: argv.prefix
    };
    console.log(chalk.bold.blue('╔══════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║       JSONL 乱序修复 CLI 工具            ║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.cyan('配置参数:'));
    console.log(`  输入路径: ${options.input}`);
    console.log(`  会话字段: ${options.sessionKeyField}`);
    console.log(`  时间字段: ${options.eventTimeField}`);
    console.log(`  分片字段: ${options.shardIdField || '(未使用)'}`);
    console.log(`  缺口阈值: ${options.gapThresholdMs}ms`);
    console.log(`  输出目录: ${options.outputDir}`);
    console.log('');
    try {
        const processor = new processor_1.SessionProcessor(options);
        const result = await processor.process();
        printSummary(result);
        process.exit(result.badRows > 0 ? 1 : 0);
    }
    catch (error) {
        console.error(chalk.red('\n❌ 处理失败:'));
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(2);
    }
}
function printSummary(result) {
    console.log(chalk.bold.green('\n✅ 处理完成！'));
    console.log('');
    const duration = result.endTime.getTime() - result.startTime.getTime();
    console.log(chalk.cyan('📊 处理摘要:'));
    console.log(`  处理时间: ${duration}ms`);
    console.log(`  总行数: ${result.totalRowsRead}`);
    console.log(`  有效行数: ${chalk.green(result.validRows.toString())}`);
    console.log(`  坏行数: ${result.badRows > 0 ? chalk.red(result.badRows.toString()) : chalk.green('0')}`);
    console.log(`  唯一会话数: ${result.uniqueSessions}`);
    console.log(`  检测到缺口数: ${result.totalGaps > 0 ? chalk.yellow(result.totalGaps.toString()) : chalk.green('0')}`);
    if (result.totalGaps > 0) {
        console.log('');
        console.log(chalk.yellow('⚠️ 缺口统计:'));
        console.log(`  总缺口时长: ${formatDuration(result.gapSummary.totalGapDuration)}`);
        console.log(`  平均缺口时长: ${formatDuration(result.gapSummary.avgGapDuration)}`);
        console.log(`  最大缺口时长: ${formatDuration(result.gapSummary.maxGapDuration)}`);
    }
    if (result.badRows > 0) {
        console.log('');
        console.log(chalk.red('❌ 坏行类型统计:'));
        const errorCounts = new Map();
        for (const bad of result.badRowDetails) {
            errorCounts.set(bad.error, (errorCounts.get(bad.error) || 0) + 1);
        }
        for (const [error, count] of Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${error}: ${count} 行`);
        }
    }
    console.log('');
    console.log(chalk.cyan('📁 输出文件:'));
    console.log(`  排序后数据: ${result.outputFiles.sortedJsonl}`);
    console.log(`  坏行记录: ${result.outputFiles.badRows}`);
    console.log(`  机器可读结果: ${result.outputFiles.machineReadable}`);
    console.log(`  详细报告: ${result.outputFiles.report}`);
    console.log('');
    if (result.badRows > 0) {
        console.log(chalk.yellow('⚠️ 注意: 存在坏行，请查看输出目录中的坏行记录和详细报告'));
    }
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000)
        return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
}
main();
