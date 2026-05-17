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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cli_progress_1 = require("cli-progress");
const chalk_1 = __importDefault(require("chalk"));
const sitemap_parser_1 = require("./sitemap-parser");
const http_checker_1 = require("./http-checker");
const report_generator_1 = require("./report-generator");
const program = new commander_1.Command();
program
    .name('sitemap-audit')
    .description('Sitemap 链接巡检工具 - 检查 XML sitemap 中的链接有效性')
    .version('1.0.0')
    .argument('<path>', 'sitemap XML 文件路径或包含 sitemap 的目录路径')
    .option('-c, --concurrency <number>', '并发请求数', '5')
    .option('-o, --output <directory>', '报告输出目录', './audit-results')
    .option('--no-json', '不导出 JSON 报告')
    .option('--no-html', '不导出 HTML 报告')
    .action(async (inputPath, options) => {
    const startTime = Date.now();
    const startedAt = new Date().toLocaleString('zh-CN');
    console.log(chalk_1.default.bold.blue('🚀 Sitemap 链接巡检开始'));
    console.log(chalk_1.default.gray(`📁 输入路径: ${inputPath}`));
    console.log(chalk_1.default.gray(`⚡ 并发数: ${options.concurrency}`));
    console.log('');
    try {
        const isDirectory = fs.lstatSync(inputPath).isDirectory();
        const parser = new sitemap_parser_1.SitemapParser();
        let parseResult;
        if (isDirectory) {
            console.log(chalk_1.default.blue('📂 扫描目录中的 sitemap 文件...'));
            parseResult = await parser.parseDirectory(inputPath);
        }
        else {
            console.log(chalk_1.default.blue('📄 解析 sitemap 文件...'));
            parseResult = await parser.parse(inputPath);
        }
        const { entries, errors: parseErrors } = parseResult;
        console.log(chalk_1.default.green(`✅ 解析完成，共发现 ${entries.length} 个链接`));
        if (parseErrors.length > 0) {
            console.log(chalk_1.default.yellow(`⚠️  发现 ${parseErrors.length} 个解析错误`));
        }
        console.log('');
        if (entries.length === 0) {
            console.log(chalk_1.default.red('❌ 没有发现可检查的链接'));
            process.exit(1);
        }
        console.log(chalk_1.default.blue('🌐 开始检查链接...'));
        const progressBar = new cli_progress_1.SingleBar({
            format: '   进度 |' + chalk_1.default.cyan('{bar}') + '| {percentage}% | {value}/{total} 链接 | {duration_formatted}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
        }, cli_progress_1.Presets.shades_classic);
        progressBar.start(entries.length, 0);
        const checker = new http_checker_1.HttpChecker(parseInt(options.concurrency));
        const originalCheckAll = checker.checkAll.bind(checker);
        let checkedCount = 0;
        checker.checkAll = async (entries) => {
            const results = [];
            const chunkSize = parseInt(options.concurrency);
            for (let i = 0; i < entries.length; i += chunkSize) {
                const chunk = entries.slice(i, i + chunkSize);
                const chunkResults = await originalCheckAll(chunk);
                results.push(...chunkResults);
                checkedCount += chunk.length;
                progressBar.update(checkedCount);
            }
            return results;
        };
        const results = await checker.checkAll(entries);
        progressBar.stop();
        console.log('');
        console.log(chalk_1.default.green('✅ 链接检查完成'));
        console.log('');
        const finishedAt = new Date().toLocaleString('zh-CN');
        const totalTime = Date.now() - startTime;
        const summary = {
            totalUrls: results.length,
            successful: results.filter(r => r.ok && !r.is404).length,
            failed: results.filter(r => !r.ok || r.is404).length,
            notFound: results.filter(r => r.is404).length,
            redirected: results.filter(r => r.isRedirect).length,
            serverErrors: results.filter(r => r.status >= 500).length,
            clientErrors: results.filter(r => r.status >= 400 && r.status < 500).length,
            parseErrors: parseErrors.length,
            avgResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
            totalTime,
        };
        const sourceFiles = [...new Set(results.map(r => r.sourceFile))];
        const auditResult = {
            summary,
            results,
            parseErrors,
            startedAt,
            finishedAt,
            sourceFiles,
        };
        const reportGenerator = new report_generator_1.ReportGenerator();
        await reportGenerator.generateConsoleSummary(auditResult);
        const outputDir = path.resolve(options.output);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        if (options.json) {
            const jsonPath = path.join(outputDir, `sitemap-audit-${timestamp}.json`);
            await reportGenerator.exportJson(auditResult, jsonPath);
        }
        if (options.html) {
            const htmlPath = path.join(outputDir, `sitemap-audit-${timestamp}.html`);
            await reportGenerator.exportHtml(auditResult, htmlPath);
        }
        const hasErrors = summary.failed > 0 || summary.parseErrors > 0;
        process.exit(hasErrors ? 1 : 0);
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 执行失败:'));
        console.error(chalk_1.default.red(error.message));
        console.error(error.stack);
        process.exit(1);
    }
});
program.parseAsync().catch(error => {
    console.error(chalk_1.default.red('Fatal error:'), error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map