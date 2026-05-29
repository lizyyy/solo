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
const path = __importStar(require("path"));
const validator_1 = require("../core/validator");
const loader_1 = require("../io/loader");
const reporter_1 = require("../report/reporter");
const program = new commander_1.Command();
program
    .name('tracker-regression')
    .description('埋点事件回归CLI工具 - 验证发版后埋点事件完整性')
    .version('1.0.0');
program
    .requiredOption('-m, --manifest <path>', '埋点清单文件路径 (JSON/YAML)')
    .requiredOption('-l, --log <path>', '事件日志文件路径 (JSON/YAML)')
    .option('-b, --baseline <path>', '基线版本清单文件，用于版本对比')
    .option('-o, --output <dir>', '输出报告目录', './reports')
    .option('-f, --format <format>', '输出格式: json|markdown|html|excel|all', 'all')
    .option('-s, --severity <level>', '最低严重级别: critical|high|medium|low|info')
    .option('-p, --page-path <path>', '按页面路径过滤')
    .option('-c, --category <category>', '按事件分类过滤')
    .option('--strict', '严格模式，所有警告视为失败', false)
    .option('--include-notes', '在报告中包含备注信息', true)
    .option('--include-attachments', '在报告中包含附件引用', true)
    .option('--sampling-delay <ms>', '采样延迟阈值(毫秒)', '5000')
    .option('--page-path-matching <mode>', '页面路径匹配模式: exact|prefix|regex', 'prefix')
    .action(async (options) => {
    try {
        const validationConfig = {
            samplingDelayThresholdMs: parseInt(options.samplingDelay, 10),
            pagePathMatching: options.pagePathMatching,
            strictTypeChecking: options.strict
        };
        const manifest = loader_1.DataLoader.loadManifest(options.manifest);
        const eventLog = loader_1.DataLoader.loadEventLog(options.log);
        let baselineManifest;
        if (options.baseline) {
            baselineManifest = loader_1.DataLoader.loadManifest(options.baseline);
        }
        console.log(`📋 加载埋点清单: ${manifest.events.length} 个事件 (版本: ${manifest.releaseVersion})`);
        console.log(`📊 加载事件日志: ${eventLog.entries.length} 条记录`);
        if (baselineManifest) {
            console.log(`📌 基线版本: ${baselineManifest.releaseVersion} (${baselineManifest.events.length} 个事件)`);
        }
        console.log('');
        const validator = new validator_1.RegressionValidator(validationConfig);
        let report = validator.validate(manifest, eventLog, baselineManifest);
        if (options.severity) {
            report = validator.filterBySeverity(report, options.severity);
        }
        if (options.pagePath) {
            report = validator.filterByPagePath(report, options.pagePath, manifest);
        }
        if (options.category) {
            report = validator.filterByCategory(report, options.category, manifest);
        }
        const terminalSummary = reporter_1.ReportGenerator.generateTerminalSummary(report);
        console.log(terminalSummary);
        const outputDir = path.resolve(options.output || './reports');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const baseFileName = `tracker-regression-${manifest.releaseVersion}-${timestamp}`;
        const formats = options.format === 'all'
            ? ['json', 'markdown', 'html', 'excel']
            : [options.format];
        for (const format of formats) {
            const filePath = path.join(outputDir, `${baseFileName}.${format === 'excel' ? 'xlsx' : format}`);
            switch (format) {
                case 'json':
                    reporter_1.ReportGenerator.writeToFile(reporter_1.ReportGenerator.generateJson(report), filePath);
                    console.log(`✅ JSON报告已生成: ${filePath}`);
                    break;
                case 'markdown':
                    reporter_1.ReportGenerator.writeToFile(reporter_1.ReportGenerator.generateMarkdown(report), filePath);
                    console.log(`✅ Markdown报告已生成: ${filePath}`);
                    break;
                case 'html':
                    reporter_1.ReportGenerator.writeToFile(reporter_1.ReportGenerator.generateHtml(report), filePath);
                    console.log(`✅ HTML报告已生成: ${filePath}`);
                    break;
                case 'excel':
                    await reporter_1.ReportGenerator.generateExcel(report, filePath);
                    console.log(`✅ Excel报告已生成: ${filePath}`);
                    break;
            }
        }
        const hasBlockingIssues = report.summary.critical > 0 || report.summary.high > 0;
        process.exit(hasBlockingIssues ? 1 : 0);
    }
    catch (error) {
        console.error('❌ 执行失败:', error.message);
        process.exit(1);
    }
});
program
    .command('init')
    .description('生成示例配置文件')
    .option('-o, --output <dir>', '输出目录', './examples')
    .action((options) => {
    console.log(`🔧 生成示例文件到: ${options.output}`);
    console.log('  - manifest.json  埋点清单示例');
    console.log('  - event-log.json 事件日志示例');
    console.log('  - baseline.json  基线版本示例');
    console.log('');
    console.log('使用示例:');
    console.log('  tracker-regression -m examples/manifest.json -l examples/event-log.json');
    console.log('  tracker-regression -m examples/manifest.json -l examples/event-log.json -b examples/baseline.json');
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map