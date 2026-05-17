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
const commander_1 = require("commander");
const parser_1 = require("./parser");
const clusterer_1 = require("./clusterer");
const reporter_1 = require("./reporter");
const self_test_1 = require("./self-test");
const fs = __importStar(require("fs"));
const program = new commander_1.Command();
program
    .name('tfc')
    .description('Test Failure Cluster - 测试失败聚类工具')
    .version('1.0.0');
program
    .command('cluster')
    .description('聚类测试失败并生成报告')
    .requiredOption('-i, --input <path>', '输入文件路径（.log 或 .json）')
    .option('-b, --baseline <path>', '历史基线 JSON 文件路径')
    .option('-j, --json <path>', '输出 JSON 结果路径')
    .option('-m, --md <path>', '输出 Markdown 报告路径')
    .option('-t, --threshold <number>', '相似度阈值 (0-1)', '0.7')
    .option('-v, --verbose', '显示详细信息')
    .option('--export-baseline <path>', '从当前结果导出基线文件')
    .action(async (options) => {
    try {
        if (!fs.existsSync(options.input)) {
            console.error(`❌ 输入文件不存在: ${options.input}`);
            process.exit(1);
        }
        const parseResult = (0, parser_1.parseInputFile)(options.input);
        let baseline = undefined;
        if (options.baseline) {
            if (!fs.existsSync(options.baseline)) {
                console.error(`❌ 基线文件不存在: ${options.baseline}`);
                process.exit(1);
            }
            baseline = (0, parser_1.loadBaseline)(options.baseline);
        }
        const threshold = parseFloat(options.threshold);
        const clusters = (0, clusterer_1.clusterFailures)(parseResult.successes, threshold, baseline);
        const result = (0, clusterer_1.buildClusterResult)(parseResult, clusters, baseline);
        (0, reporter_1.printConsoleSummary)(result, options.verbose);
        if (options.json) {
            (0, reporter_1.writeJsonReport)(result, options.json);
            console.log(`📄 JSON 结果已写入: ${options.json}`);
        }
        if (options.md) {
            (0, reporter_1.writeMarkdownReport)(result, options.md);
            console.log(`📑 Markdown 报告已写入: ${options.md}`);
        }
        if (options.exportBaseline) {
            const newBaseline = (0, clusterer_1.createBaselineFromResult)(result);
            fs.writeFileSync(options.exportBaseline, JSON.stringify(newBaseline, null, 2), 'utf-8');
            console.log(`📍 基线文件已导出: ${options.exportBaseline}`);
        }
    }
    catch (error) {
        console.error('❌ 处理失败:', error.message);
        process.exit(1);
    }
});
program
    .command('self-test')
    .description('运行自检，验证所有功能')
    .action(async () => {
    const success = await (0, self_test_1.runSelfTest)();
    process.exit(success ? 0 : 1);
});
program.parseAsync(process.argv);
