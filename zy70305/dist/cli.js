#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const scan_engine_1 = require("./scan-engine");
const config_loader_1 = require("./config-loader");
const compliance_manager_1 = require("./compliance-manager");
const report_generator_1 = require("./report-generator");
const program = new commander_1.Command();
program
    .name('openapi-drift')
    .description('OpenAPI 契约漂移检测 CLI 工具')
    .version('1.0.0');
program
    .command('scan')
    .description('扫描契约差异')
    .option('-c, --config <path>', '配置文件路径')
    .option('-s, --services <names>', '按服务名筛选，逗号分隔')
    .option('-p, --paths <patterns>', '按路径筛选，逗号分隔')
    .option('-m, --methods <methods>', '按 HTTP 方法筛选，逗号分隔')
    .option('-o, --owners <names>', '按负责人筛选，逗号分隔')
    .option('--severity <levels>', '按严重级别筛选 (blocker,warning,info)')
    .option('--impact <levels>', '按影响级别筛选 (caller-must-change,attention-only,ignorable)')
    .option('--format <format>', '输出格式 (console|markdown|csv|all)', 'console')
    .option('--output-dir <dir>', '输出目录')
    .option('--show-exempted', '显示已豁免的变更')
    .option('--show-confirmed', '显示已确认的变更')
    .option('--fail-on-blocker', '遇到阻断级别变更时退出码为 1')
    .action(async (options) => {
    try {
        const baseDir = process.cwd();
        const engine = new scan_engine_1.ScanEngine(baseDir);
        const configLoader = engine.getConfigLoader();
        const configPath = options.config || 'openapi-drift.yaml';
        const { config, anomalies: configAnomalies } = configLoader.loadCliConfig(configPath);
        let exemptions = [];
        let confirmations = [];
        const allAnomalies = [...configAnomalies];
        if (config.exemptionsPath) {
            const result = configLoader.loadExemptions(config.exemptionsPath);
            exemptions = result.exemptions;
            allAnomalies.push(...result.anomalies);
        }
        if (config.confirmationsPath) {
            const result = configLoader.loadConfirmations(config.confirmationsPath);
            confirmations = result.confirmations;
            allAnomalies.push(...result.anomalies);
        }
        const filterOptions = {};
        if (options.services) {
            filterOptions.services = options.services.split(',').map((s) => s.trim());
        }
        if (options.paths) {
            filterOptions.paths = options.paths.split(',').map((s) => s.trim());
        }
        if (options.methods) {
            filterOptions.methods = options.methods
                .split(',')
                .map((s) => s.trim().toLowerCase());
        }
        if (options.owners) {
            filterOptions.owners = options.owners.split(',').map((s) => s.trim());
        }
        if (options.severity) {
            filterOptions.severities = options.severity.split(',').map((s) => s.trim());
        }
        if (options.impact) {
            filterOptions.impacts = options.impact.split(',').map((s) => s.trim());
        }
        const result = engine.scan(configPath, filterOptions);
        const compliance = new compliance_manager_1.ComplianceManager(config.services, exemptions, confirmations);
        let displayDiffs = result.filteredDiffs;
        if (!options.showExempted) {
            displayDiffs = compliance.filterByExemptionStatus(displayDiffs, false);
        }
        if (!options.showConfirmed) {
            displayDiffs = compliance.filterByConfirmationStatus(displayDiffs, false);
        }
        printConsoleReport({ ...result, filteredDiffs: displayDiffs });
        const outputDir = options.outputDir || config.outputDir;
        const formats = options.format.split(',');
        if (formats.includes('markdown') || formats.includes('all')) {
            const reporter = new report_generator_1.ReportGenerator(outputDir);
            const mdPath = reporter.generateMarkdown({ ...result, filteredDiffs: displayDiffs });
            console.log(chalk_1.default.green(`\n✓ Markdown 报告已生成: ${mdPath}`));
        }
        if (formats.includes('csv') || formats.includes('all')) {
            const reporter = new report_generator_1.ReportGenerator(outputDir);
            const csvPath = reporter.generateCsv({ ...result, filteredDiffs: displayDiffs });
            console.log(chalk_1.default.green(`✓ CSV 报告已生成: ${csvPath}`));
        }
        if (options.failOnBlocker && result.summary.hasBlockers) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('confirm')
    .description('确认变更，允许发布')
    .requiredOption('-c, --config <path>', '配置文件路径')
    .requiredOption('--diff-id <id>', '变更 ID')
    .requiredOption('--by <name>', '确认人姓名/邮箱')
    .option('--notes <text>', '备注信息')
    .action(async (options) => {
    try {
        const baseDir = process.cwd();
        const configLoader = new config_loader_1.ConfigLoader(baseDir);
        const configPath = options.config;
        const { config } = configLoader.loadCliConfig(configPath);
        let confirmations = [];
        if (config.confirmationsPath) {
            const result = configLoader.loadConfirmations(config.confirmationsPath);
            confirmations = result.confirmations;
        }
        let exemptions = [];
        if (config.exemptionsPath) {
            const result = configLoader.loadExemptions(config.exemptionsPath);
            exemptions = result.exemptions;
        }
        const engine = new scan_engine_1.ScanEngine(baseDir);
        const scanResult = engine.scan(configPath);
        const diff = scanResult.diffs.find(d => d.id === options.diffId);
        if (!diff) {
            console.error(chalk_1.default.red(`找不到变更 ID: ${options.diffId}`));
            process.exit(1);
        }
        const compliance = new compliance_manager_1.ComplianceManager(config.services, exemptions, confirmations);
        const confirmation = compliance.addConfirmation(diff, options.by, options.notes);
        if (config.confirmationsPath) {
            configLoader.saveConfirmations(config.confirmationsPath, compliance.getConfirmations());
        }
        console.log(chalk_1.default.green(`✓ 变更已确认`));
        console.log(`  - 服务: ${confirmation.serviceName}`);
        console.log(`  - 路径: ${confirmation.method.toUpperCase()} ${confirmation.path}`);
        console.log(`  - 变更类型: ${confirmation.changeType}`);
        console.log(`  - 确认人: ${confirmation.confirmedBy}`);
        console.log(`  - 时间: ${confirmation.confirmedAt}`);
        if (confirmation.notes) {
            console.log(`  - 备注: ${confirmation.notes}`);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('exempt')
    .description('添加短期豁免')
    .requiredOption('-c, --config <path>', '配置文件路径')
    .requiredOption('--service <name>', '服务名')
    .requiredOption('--path <path>', 'API 路径')
    .requiredOption('--method <method>', 'HTTP 方法')
    .requiredOption('--reason <text>', '豁免原因')
    .requiredOption('--days <number>', '豁免天数')
    .requiredOption('--by <name>', '创建人')
    .option('--field <name>', '特定字段 (可选)')
    .action(async (options) => {
    try {
        const baseDir = process.cwd();
        const configLoader = new config_loader_1.ConfigLoader(baseDir);
        const configPath = options.config;
        const { config } = configLoader.loadCliConfig(configPath);
        let exemptions = [];
        if (config.exemptionsPath) {
            const result = configLoader.loadExemptions(config.exemptionsPath);
            exemptions = result.exemptions;
        }
        let confirmations = [];
        if (config.confirmationsPath) {
            const result = configLoader.loadConfirmations(config.confirmationsPath);
            confirmations = result.confirmations;
        }
        const compliance = new compliance_manager_1.ComplianceManager(config.services, exemptions, confirmations);
        const exemption = compliance.addExemption(options.service, options.path, options.method, options.field, options.reason, parseInt(options.days), options.by);
        if (config.exemptionsPath) {
            configLoader.saveExemptions(config.exemptionsPath, compliance.getExemptions());
        }
        console.log(chalk_1.default.green(`✓ 豁免已添加`));
        console.log(`  - ID: ${exemption.id}`);
        console.log(`  - 服务: ${exemption.serviceName}`);
        console.log(`  - 路径: ${exemption.method.toUpperCase()} ${exemption.path}`);
        console.log(`  - 原因: ${exemption.reason}`);
        console.log(`  - 过期时间: ${exemption.expiresAt}`);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('list')
    .description('列出服务和负责人')
    .requiredOption('-c, --config <path>', '配置文件路径')
    .option('--service <name>', '显示特定服务详情')
    .action(async (options) => {
    try {
        const baseDir = process.cwd();
        const configLoader = new config_loader_1.ConfigLoader(baseDir);
        const configPath = options.config;
        const { config } = configLoader.loadCliConfig(configPath);
        if (options.service) {
            const service = config.services.find(s => s.serviceName === options.service);
            if (!service) {
                console.error(chalk_1.default.red(`找不到服务: ${options.service}`));
                process.exit(1);
            }
            console.log(chalk_1.default.bold(`\n服务: ${service.serviceName}`));
            console.log(`  负责人: ${service.owners.join(', ')}`);
            console.log(`  旧契约: ${service.oldContractPath}`);
            console.log(`  新契约: ${service.newContractPath}`);
            if (service.samplesPath) {
                console.log(`  样本: ${service.samplesPath}`);
            }
        }
        else {
            const table = new cli_table3_1.default({
                head: ['服务', '负责人', '旧契约', '新契约'],
                colWidths: [20, 20, 35, 35]
            });
            for (const service of config.services) {
                table.push([
                    service.serviceName,
                    service.owners.join(', '),
                    truncate(service.oldContractPath, 30),
                    truncate(service.newContractPath, 30)
                ]);
            }
            console.log('\n' + table.toString());
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
function printConsoleReport(result) {
    const summary = result.summary;
    console.log(chalk_1.default.bold('\n=== OpenAPI 契约漂移检测报告 ===\n'));
    const summaryTable = new cli_table3_1.default({
        head: ['指标', '数值'],
        colWidths: [25, 50]
    });
    summaryTable.push(['服务数', String(summary.totalServices)], ['接口数', String(summary.totalPaths)], ['差异总数', String(summary.totalDiffs)], [
        chalk_1.default.red('🔴 阻断级别'),
        chalk_1.default.red(String(summary.blockerCount))
    ], [
        chalk_1.default.yellow('🟡 警告级别'),
        chalk_1.default.yellow(String(summary.warningCount))
    ], [
        chalk_1.default.blue('🔵 信息级别'),
        chalk_1.default.blue(String(summary.infoCount))
    ], [
        chalk_1.default.red('❗ 调用方必须修改'),
        chalk_1.default.red(String(summary.callerMustChangeCount))
    ], [
        chalk_1.default.yellow('⚠️ 仅需关注'),
        chalk_1.default.yellow(String(summary.attentionOnlyCount))
    ], [
        chalk_1.default.green('✅ 可忽略'),
        chalk_1.default.green(String(summary.ignorableCount))
    ], ['样本分析', `${summary.samplesAnalyzed} 个, ${summary.sampleIssues} 问题`], ['异常情况', String(summary.anomaliesCount)], ['已豁免', String(summary.exemptedCount)], ['已确认', String(summary.confirmedCount)]);
    console.log(summaryTable.toString());
    if (summary.hasBlockers) {
        console.log(chalk_1.default.red('\n⚠️  存在阻断级别的变更，建议暂停发布并修复！\n'));
    }
    if (result.filteredDiffs.length > 0) {
        const byImpact = {
            'caller-must-change': [],
            'attention-only': [],
            'ignorable': []
        };
        for (const diff of result.filteredDiffs) {
            byImpact[diff.impact].push(diff);
        }
        if (byImpact['caller-must-change'].length > 0) {
            console.log(chalk_1.default.bold.red('\n❗ 调用方必须修改:\n'));
            printDiffs(byImpact['caller-must-change'], result.confirmations);
        }
        if (byImpact['attention-only'].length > 0) {
            console.log(chalk_1.default.bold.yellow('\n⚠️ 仅需关注:\n'));
            printDiffs(byImpact['attention-only'], result.confirmations);
        }
        if (byImpact['ignorable'].length > 0) {
            console.log(chalk_1.default.bold.green('\n✅ 可忽略:\n'));
            printDiffs(byImpact['ignorable'], result.confirmations);
        }
    }
    else {
        console.log(chalk_1.default.green('\n✓ 未检测到需要关注的变更\n'));
    }
    const sampleWithIssues = result.sampleAnalyses.filter((a) => a.issues.length > 0);
    if (sampleWithIssues.length > 0) {
        console.log(chalk_1.default.bold.magenta('\n🔍 调用样本问题:\n'));
        for (const analysis of sampleWithIssues) {
            console.log(`  样本: ${analysis.sample.source}#${analysis.sample.lineNumber || ''}`);
            for (const issue of analysis.issues) {
                console.log(chalk_1.default.magenta(`    - ${issue.description}`));
            }
        }
    }
    if (result.anomalies.length > 0) {
        console.log(chalk_1.default.bold.yellow('\n⚠️ 异常情况:\n'));
        for (const anomaly of result.anomalies) {
            console.log(chalk_1.default.yellow(`  [${anomaly.type}] ${anomaly.message}`));
            console.log(`    来源: ${anomaly.source}`);
        }
    }
}
function printDiffs(diffs, confirmations) {
    for (const diff of diffs) {
        const confirmation = confirmations.find((c) => c.serviceName === diff.serviceName &&
            c.path === diff.path &&
            c.method === diff.method &&
            c.changeType === diff.changeType &&
            c.field === diff.field);
        const severityColor = diff.severity === 'blocker'
            ? chalk_1.default.red
            : diff.severity === 'warning'
                ? chalk_1.default.yellow
                : chalk_1.default.blue;
        let line = `  [${diff.serviceName}] ${diff.method.toUpperCase()} ${diff.path}`;
        if (diff.field) {
            line += ` - ${diff.field}`;
        }
        console.log(severityColor(line));
        console.log(`    ${diff.description}`);
        console.log(`    ID: ${diff.id}`);
        if (confirmation) {
            console.log(chalk_1.default.green(`    ✓ 已确认: ${confirmation.confirmedBy} @ ${confirmation.confirmedAt}`));
        }
        console.log('');
    }
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return '...' + str.slice(-(maxLen - 3));
}
program.parse(process.argv);
//# sourceMappingURL=cli.js.map