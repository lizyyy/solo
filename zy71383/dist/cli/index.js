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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const driftChecker_1 = require("../core/driftChecker");
const reportExporter_1 = require("../core/reportExporter");
const diffInterpreter_1 = require("../core/diffInterpreter");
const program = new commander_1.Command();
program
    .name('cdc')
    .description('配置漂移检查工具 (Config Drift Checker)')
    .version('1.0.0');
let lastReport = null;
const REPORT_CACHE_FILE = path.join(process.cwd(), 'data', 'last-report.json');
function loadLastReport() {
    try {
        if (fs.existsSync(REPORT_CACHE_FILE)) {
            const content = fs.readFileSync(REPORT_CACHE_FILE, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch {
        // ignore
    }
    return null;
}
function saveLastReport(report) {
    try {
        const dir = path.dirname(REPORT_CACHE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(REPORT_CACHE_FILE, JSON.stringify(report, null, 2), 'utf-8');
    }
    catch {
        // ignore
    }
}
lastReport = loadLastReport();
program
    .command('import')
    .description('导入配置文件、默认值或变更记录')
    .option('-c, --config <path>', '配置文件路径')
    .option('-e, --environment <name>', '环境名称 (development/testing/production)')
    .option('-d, --defaults <path>', '默认值配置文件路径 (JSON格式)')
    .option('-h, --changes <path>', '变更记录文件路径 (JSON格式)')
    .option('-D, --dir <path>', '批量导入目录')
    .option('-p, --pattern <glob>', '批量导入文件匹配模式', '**/*.{json,yaml,yml,env}')
    .option('-f, --format <json|yaml|env>', '强制指定文件格式')
    .option('--clear', '导入前清空现有数据')
    .action(async (options) => {
    try {
        let hasErrors = false;
        if (options.clear) {
            driftChecker_1.driftChecker.clearStore();
            console.log(chalk_1.default.blue('ℹ️  已清空现有数据'));
        }
        if (options.config) {
            if (!options.environment) {
                console.error(chalk_1.default.red('❌ 错误: 导入单个配置文件时必须指定 --environment'));
                process.exit(1);
            }
            const result = driftChecker_1.driftChecker.importConfig(options.config, options.environment, options.format);
            printImportResult(result, `配置文件 ${options.config}`);
            if (!result.success)
                hasErrors = true;
        }
        if (options.defaults) {
            const result = driftChecker_1.driftChecker.importDefaults(options.defaults);
            printImportResult(result, `默认值配置 ${options.defaults}`);
            if (!result.success)
                hasErrors = true;
        }
        if (options.changes) {
            const result = driftChecker_1.driftChecker.importChanges(options.changes);
            printImportResult(result, `变更记录 ${options.changes}`);
            if (!result.success)
                hasErrors = true;
        }
        if (options.dir) {
            const result = driftChecker_1.driftChecker.importDirectory(options.dir, options.pattern);
            printImportResult(result, `目录 ${options.dir}`);
            if (!result.success)
                hasErrors = true;
        }
        if (!options.config && !options.defaults && !options.changes && !options.dir) {
            console.error(chalk_1.default.red('❌ 错误: 请指定要导入的内容 (--config, --defaults, --changes, 或 --dir)'));
            process.exit(1);
        }
        const envs = driftChecker_1.driftChecker.getEnvironments();
        if (envs.length > 0) {
            console.log(chalk_1.default.green(`\n✅ 当前已导入环境: ${envs.join(', ')}`));
        }
        if (hasErrors) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 导入失败: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
});
program
    .command('check')
    .description('执行配置漂移检查')
    .option('-b, --baseline <env>', '基线环境名称', 'development')
    .option('-t, --target <envs...>', '目标环境名称（多个用空格分隔），默认比较所有其他环境')
    .option('--ignore-array-order', '忽略数组顺序差异（仅比较元素是否相同）')
    .option('--no-secrets', '禁用明文密钥检测')
    .option('--no-defaults', '禁用默认值检查')
    .action(async (options) => {
    try {
        const envs = driftChecker_1.driftChecker.getEnvironments();
        if (envs.length === 0) {
            console.error(chalk_1.default.red('❌ 错误: 没有已导入的配置，请先使用 import 命令导入配置'));
            process.exit(1);
        }
        if (!envs.includes(options.baseline)) {
            console.error(chalk_1.default.red(`❌ 错误: 基线环境 "${options.baseline}" 不存在。可用环境: ${envs.join(', ')}`));
            process.exit(1);
        }
        let targetEnvs = undefined;
        if (options.target && options.target.length > 0) {
            for (const target of options.target) {
                if (!envs.includes(target)) {
                    console.error(chalk_1.default.red(`❌ 错误: 目标环境 "${target}" 不存在。可用环境: ${envs.join(', ')}`));
                    process.exit(1);
                }
            }
            targetEnvs = options.target;
        }
        console.log(chalk_1.default.blue(`🔍 开始检查配置漂移...`));
        console.log(chalk_1.default.blue(`   基线环境: ${options.baseline}`));
        if (targetEnvs) {
            console.log(chalk_1.default.blue(`   目标环境: ${targetEnvs.join(', ')}`));
        }
        else {
            console.log(chalk_1.default.blue(`   目标环境: 所有其他环境`));
        }
        const report = driftChecker_1.driftChecker.checkDrift(options.baseline, targetEnvs, {
            ignoreArrayOrder: options.ignoreArrayOrder,
        });
        lastReport = report;
        saveLastReport(report);
        console.log(chalk_1.default.green(driftChecker_1.driftChecker.formatReportSummary(report)));
        if (report.diffs.length > 0) {
            console.log(chalk_1.default.yellow(`\n📋 差异详情预览（前5项）:\n`));
            const previewDiffs = report.diffs.slice(0, 5);
            for (const diff of previewDiffs) {
                console.log(diffInterpreter_1.interpreter.formatForDisplay(diff));
            }
            if (report.diffs.length > 5) {
                console.log(chalk_1.default.gray(`\n... 还有 ${report.diffs.length - 5} 项差异，请使用 query 或 export 命令查看完整结果`));
            }
            if (report.requiresManualReview > 0) {
                console.log(chalk_1.default.red(`\n⚠️  重要: 有 ${report.requiresManualReview} 项需要人工处理！`));
                console.log(chalk_1.default.red(`   使用 "cdc query --requires-review" 查看需要处理的项`));
            }
        }
        else {
            console.log(chalk_1.default.green(`\n🎉 太棒了！未检测到任何配置漂移！`));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 检查失败: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
});
program
    .command('query')
    .description('查询上一次检查的差异结果')
    .option('-e, --environment <env>', '按环境筛选')
    .option('-s, --severity <level>', '按严重级别筛选 (critical/warning/info/false_positive)')
    .option('-k, --key <pattern>', '按键名模式筛选 (正则表达式)')
    .option('-r, --requires-review', '仅显示需要人工审核的项')
    .option('-t, --type <type>', '按差异类型筛选')
    .option('--limit <number>', '限制显示数量', '50')
    .action(async (options) => {
    if (!lastReport) {
        console.error(chalk_1.default.red('❌ 错误: 没有可用的检查结果，请先运行 check 命令'));
        process.exit(1);
    }
    const queryOptions = {
        environment: options.environment,
        severity: options.severity,
        keyPattern: options.key,
        requiresReview: options.requiresReview,
    };
    const results = driftChecker_1.driftChecker.queryDiffs(lastReport, queryOptions);
    const limit = parseInt(options.limit, 10);
    if (results.length === 0) {
        console.log(chalk_1.default.yellow('ℹ️  没有找到匹配的差异项'));
        return;
    }
    console.log(chalk_1.default.blue(`\n📋 查询结果: 共 ${results.length} 项${results.length > limit ? `（显示前 ${limit} 项）` : ''}\n`));
    const displayResults = results.slice(0, limit);
    for (const diff of displayResults) {
        console.log(diffInterpreter_1.interpreter.formatForDisplay(diff));
    }
    console.log(chalk_1.default.blue(`\n📊 统计: 找到 ${results.length} 个匹配的差异项`));
});
program
    .command('history')
    .description('查看变更历史记录')
    .option('-k, --key <pattern>', '按配置项筛选')
    .option('-e, --environment <env>', '按环境筛选')
    .option('-l, --limit <number>', '限制显示数量', '20')
    .action(async (options) => {
    const changes = driftChecker_1.driftChecker.getChangeHistory(options.key, options.environment);
    const limit = parseInt(options.limit, 10);
    if (changes.length === 0) {
        console.log(chalk_1.default.yellow('ℹ️  没有找到变更记录'));
        return;
    }
    console.log(chalk_1.default.blue(`\n📜 变更历史: 共 ${changes.length} 条记录\n`));
    const displayChanges = changes.slice(0, limit);
    for (const change of displayChanges) {
        console.log(chalk_1.default.cyan(`[${change.timestamp}]`));
        console.log(`  ID: ${change.id}`);
        console.log(`  环境: ${change.environment}`);
        console.log(`  配置项: ${change.key}`);
        console.log(`  变更: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`);
        if (change.author)
            console.log(`  操作人: ${change.author}`);
        if (change.reason)
            console.log(`  原因: ${change.reason}`);
        if (change.ticketId)
            console.log(`  工单: ${change.ticketId}`);
        console.log('');
    }
});
program
    .command('export')
    .description('导出漂移检查报告')
    .option('-f, --format <json|markdown>', '导出格式', 'markdown')
    .option('-o, --output <path>', '输出文件路径')
    .option('--include-masked', '包含遮蔽后的配置值')
    .option('--include-suggestions', '包含建议操作')
    .action(async (options) => {
    if (!lastReport) {
        console.error(chalk_1.default.red('❌ 错误: 没有可用的检查结果，请先运行 check 命令'));
        process.exit(1);
    }
    const format = options.format === 'json' ? 'json' : 'markdown';
    const ext = format === 'json' ? 'json' : 'md';
    const outputPath = options.output || `reports/drift-report-${Date.now()}.${ext}`;
    try {
        const exportedPath = reportExporter_1.reportExporter.export(lastReport, {
            format,
            outputPath,
            includeMaskedValues: options.includeMasked,
            includeSuggestions: options.includeSuggestions,
        });
        console.log(chalk_1.default.green(`✅ 报告已导出到: ${exportedPath}`));
        console.log(chalk_1.default.blue(`   格式: ${format.toUpperCase()}`));
        console.log(chalk_1.default.blue(`   包含遮蔽值: ${options.includeMasked ? '是' : '否'}`));
        console.log(chalk_1.default.blue(`   包含建议操作: ${options.includeSuggestions ? '是' : '否'}`));
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ 导出失败: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
});
program
    .command('list')
    .description('列出已导入的环境和配置')
    .action(async () => {
    const envs = driftChecker_1.driftChecker.getEnvironments();
    if (envs.length === 0) {
        console.log(chalk_1.default.yellow('ℹ️  没有已导入的配置'));
        return;
    }
    console.log(chalk_1.default.blue(`\n📋 已导入的环境 (${envs.length}):\n`));
    for (const env of envs) {
        const config = driftChecker_1.driftChecker.getConfigDetails(env);
        if (config) {
            console.log(chalk_1.default.cyan(`  ${env}`));
            console.log(`    文件: ${config.path}`);
            console.log(`    格式: ${config.format}`);
            console.log(`    导入时间: ${config.importedAt}`);
            console.log(`    校验和: ${config.checksum.substring(0, 16)}...`);
            console.log('');
        }
    }
});
program
    .command('clear')
    .description('清空所有已导入的数据')
    .option('-y, --yes', '跳过确认提示')
    .action(async (options) => {
    if (!options.yes) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        readline.question(chalk_1.default.yellow('⚠️  确定要清空所有已导入的数据吗？此操作不可恢复 (y/N): '), (answer) => {
            readline.close();
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                driftChecker_1.driftChecker.clearStore();
                lastReport = null;
                if (fs.existsSync(REPORT_CACHE_FILE)) {
                    fs.unlinkSync(REPORT_CACHE_FILE);
                }
                console.log(chalk_1.default.green('✅ 已清空所有数据'));
            }
            else {
                console.log(chalk_1.default.blue('ℹ️  操作已取消'));
            }
        });
    }
    else {
        driftChecker_1.driftChecker.clearStore();
        lastReport = null;
        if (fs.existsSync(REPORT_CACHE_FILE)) {
            fs.unlinkSync(REPORT_CACHE_FILE);
        }
        console.log(chalk_1.default.green('✅ 已清空所有数据'));
    }
});
function printImportResult(result, label) {
    if (result.success) {
        console.log(chalk_1.default.green(`✅ ${label} 导入成功`));
        result.importedFiles.forEach(f => console.log(chalk_1.default.gray(`   - ${f}`)));
        if (result.warnings.length > 0) {
            console.log(chalk_1.default.yellow(`\n⚠️  警告:`));
            result.warnings.forEach(w => console.log(chalk_1.default.yellow(`   - ${w}`)));
        }
        if (result.detectedSecrets.length > 0) {
            console.log(chalk_1.default.red(`\n🔴 检测到明文密钥 (${result.detectedSecrets.length} 个):`));
            result.detectedSecrets.forEach(s => console.log(chalk_1.default.red(`   - ${s}`)));
        }
    }
    else {
        console.log(chalk_1.default.red(`❌ ${label} 导入失败`));
        result.errors.forEach(e => console.log(chalk_1.default.red(`   - ${e}`)));
    }
}
program.parse(process.argv);
//# sourceMappingURL=index.js.map