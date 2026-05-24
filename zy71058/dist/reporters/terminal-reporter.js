"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printTerminalSummary = printTerminalSummary;
exports.getExitCode = getExitCode;
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
const severityColors = {
    critical: chalk_1.default.red.bold,
    high: chalk_1.default.red,
    medium: chalk_1.default.yellow,
    low: chalk_1.default.blue
};
const severityLabels = {
    critical: '严重',
    high: '高危',
    medium: '中危',
    low: '低危'
};
function maskValue(value) {
    if (value.length <= 8) {
        return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}
function printTerminalSummary(result, verbose = false) {
    console.log('\n' + chalk_1.default.cyan('='.repeat(70)));
    console.log(chalk_1.default.cyan.bold('           Helm Values 泄密扫描报告'));
    console.log(chalk_1.default.cyan('='.repeat(70)));
    console.log('');
    console.log(chalk_1.default.bold('📋 扫描信息'));
    console.log(chalk_1.default.gray('  扫描时间: ') + result.metadata.scannedAt);
    console.log(chalk_1.default.gray('  环境:     ') + result.metadata.environment);
    console.log(chalk_1.default.gray('  Values:   ') + result.metadata.valuesFile);
    if (result.metadata.templateDir) {
        console.log(chalk_1.default.gray('  模板目录: ') + result.metadata.templateDir);
    }
    console.log('');
    console.log(chalk_1.default.bold('📊 扫描摘要'));
    const summaryData = [
        [chalk_1.default.gray('扫描文件数'), result.summary.totalFiles.toString()],
        [chalk_1.default.gray('发现问题数'), result.summary.totalFindings.toString()],
        [severityColors.critical('🔴 严重'), result.summary.bySeverity.critical.toString()],
        [severityColors.high('🔴 高危'), result.summary.bySeverity.high.toString()],
        [severityColors.medium('🟡 中危'), result.summary.bySeverity.medium.toString()],
        [severityColors.low('🔵 低危'), result.summary.bySeverity.low.toString()],
        [chalk_1.default.gray('📌 已例外'), chalk_1.default.green(result.summary.excepted.toString())],
        [chalk_1.default.gray('⚠️  过期例外'), chalk_1.default.red(result.summary.expiredExceptions.toString())]
    ];
    console.log((0, table_1.table)(summaryData, {
        border: {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼'
        },
        columns: [{ width: 15 }, { width: 10 }]
    }));
    const activeFindings = result.findings.filter(f => !f.excepted);
    if (activeFindings.length > 0) {
        console.log(chalk_1.default.bold('🔍 发现的敏感信息'));
        console.log('');
        const bySeverity = ['critical', 'high', 'medium', 'low'];
        for (const sev of bySeverity) {
            const sevFindings = activeFindings.filter(f => f.severity === sev);
            if (sevFindings.length === 0)
                continue;
            console.log(severityColors[sev](`${severityLabels[sev]}级别 (${sevFindings.length} 项)`));
            console.log(severityColors[sev]('─'.repeat(50)));
            for (const finding of sevFindings) {
                printFinding(finding, verbose);
            }
            console.log('');
        }
    }
    if (result.summary.excepted > 0) {
        console.log(chalk_1.default.bold.green('📌 已例外的项目'));
        const exceptedFindings = result.findings.filter(f => f.excepted);
        for (const finding of exceptedFindings) {
            console.log(chalk_1.default.gray(`  • [${finding.ruleName}] ${finding.location.path}`));
            if (finding.exception?.reason) {
                console.log(chalk_1.default.gray(`    原因: ${finding.exception.reason}`));
            }
        }
        console.log('');
    }
    if (result.summary.expiredExceptions > 0) {
        console.log(chalk_1.default.bold.red('⚠️  已过期的例外（需要处理！）'));
        const expiredFindings = result.findings.filter(f => f.exceptionExpired);
        for (const finding of expiredFindings) {
            console.log(chalk_1.default.red(`  • [${finding.ruleName}] ${finding.location.path}`));
            console.log(chalk_1.default.red(`    过期时间: ${finding.exception?.expiresAt}`));
        }
        console.log('');
    }
    if (result.errors.length > 0) {
        console.log(chalk_1.default.bold.red('❌ 错误'));
        for (const err of result.errors) {
            console.log(chalk_1.default.red(`  • ${err}`));
        }
        console.log('');
    }
    if (result.warnings.length > 0) {
        console.log(chalk_1.default.bold.yellow('⚠️  警告'));
        for (const warn of result.warnings) {
            console.log(chalk_1.default.yellow(`  • ${warn}`));
        }
        console.log('');
    }
    const hasBlockingIssues = activeFindings.some(f => f.severity === 'critical' || f.severity === 'high');
    if (hasBlockingIssues) {
        console.log(chalk_1.default.red.bold('❌ 扫描失败：发现严重或高危级别的敏感信息！'));
    }
    else if (result.summary.expiredExceptions > 0) {
        console.log(chalk_1.default.yellow.bold('⚠️  扫描警告：存在已过期的例外配置！'));
    }
    else {
        console.log(chalk_1.default.green.bold('✅ 扫描通过'));
    }
    console.log('');
}
function printFinding(finding, verbose) {
    const color = severityColors[finding.severity];
    console.log(color(`  [${finding.ruleName}]`));
    console.log(chalk_1.default.gray(`    文件: ${finding.location.file}`));
    console.log(chalk_1.default.gray(`    路径: ${finding.location.path}`));
    if (finding.location.line) {
        console.log(chalk_1.default.gray(`    行号: ${finding.location.line}`));
    }
    if (finding.isBase64Encoded) {
        console.log(chalk_1.default.gray(`    编码: Base64 编码值`));
        if (verbose && finding.decodedValue) {
            console.log(chalk_1.default.gray(`    解码: ${maskValue(finding.decodedValue)}`));
        }
    }
    if (verbose) {
        console.log(chalk_1.default.gray(`    匹配: ${maskValue(finding.matchedValue)}`));
    }
    console.log(chalk_1.default.gray(`    说明: ${finding.description}`));
    console.log('');
}
function getExitCode(result, failOnSeverity) {
    if (result.errors.length > 0) {
        return 2;
    }
    const activeFindings = result.findings.filter(f => !f.excepted);
    for (const finding of activeFindings) {
        if (failOnSeverity.includes(finding.severity)) {
            return 1;
        }
    }
    if (result.summary.expiredExceptions > 0) {
        return 0;
    }
    return 0;
}
