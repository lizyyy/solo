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
exports.printTerminalSummary = printTerminalSummary;
exports.writeJsonReport = writeJsonReport;
exports.writeMarkdownReport = writeMarkdownReport;
exports.generateReports = generateReports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const table_1 = require("table");
function printTerminalSummary(result, verbose = false) {
    console.log('\n');
    console.log(chalk_1.default.bold.blue('════════════════════════════════════════════════════════════'));
    console.log(chalk_1.default.bold.blue('           Package Exports 体检报告'));
    console.log(chalk_1.default.bold.blue('════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk_1.default.bold('📦 包信息:'));
    console.log(`   名称: ${chalk_1.default.cyan(result.packageName)}`);
    console.log(`   版本: ${chalk_1.default.cyan(result.packageVersion)}`);
    console.log(`   目录: ${chalk_1.default.gray(result.packageDir)}`);
    console.log(`   时间: ${chalk_1.default.gray(result.checkedAt)}`);
    console.log('');
    console.log(chalk_1.default.bold('📊 摘要统计:'));
    const summaryData = [
        [chalk_1.default.bold('指标'), chalk_1.default.bold('数量'), chalk_1.default.bold('状态')],
        ['总导出入口', result.summary.totalExports.toString(), ''],
        ['有效导出', chalk_1.default.green(result.summary.validExports.toString()), '✅'],
        ['无效导出', chalk_1.default.red(result.summary.invalidExports.toString()), result.summary.invalidExports > 0 ? '❌' : '✅'],
        ['缺失文件', chalk_1.default.yellow(result.summary.missingFiles.toString()), result.summary.missingFiles > 0 ? '⚠️' : '✅'],
        ['扫描文件', result.summary.totalFiles.toString(), ''],
    ];
    console.log((0, table_1.table)(summaryData, {
        header: {
            alignment: 'center',
            content: chalk_1.default.bold('统计数据'),
        },
    }));
    if (result.errors.length > 0) {
        console.log(chalk_1.default.bold.red('❌ 错误:'));
        result.errors.forEach((err, i) => {
            console.log(`   ${i + 1}. ${chalk_1.default.red(err)}`);
        });
        console.log('');
    }
    if (result.warnings.length > 0) {
        console.log(chalk_1.default.bold.yellow('⚠️  警告:'));
        result.warnings.forEach((warn, i) => {
            console.log(`   ${i + 1}. ${chalk_1.default.yellow(warn)}`);
        });
        console.log('');
    }
    const invalidExports = result.exports.filter(e => !e.fileExists);
    if (invalidExports.length > 0) {
        console.log(chalk_1.default.bold.red('🔴 无效导出详情:'));
        invalidExports.forEach((exp, i) => {
            console.log(`   ${i + 1}. ${chalk_1.default.bold(exp.exportPath)}`);
            console.log(`       解析路径: ${chalk_1.default.gray(exp.resolvedPath || '(null)')}`);
            if (exp.error) {
                console.log(`       错误: ${chalk_1.default.red(exp.error)}`);
            }
            if (exp.conditions.length > 0) {
                console.log(`       条件: ${chalk_1.default.cyan(exp.conditions.join(', '))}`);
            }
            console.log(`       来源: ${chalk_1.default.magenta(exp.source)}`);
        });
        console.log('');
    }
    if (result.missingPaths.length > 0) {
        console.log(chalk_1.default.bold.yellow('🟡 缺失路径详情:'));
        result.missingPaths.forEach((mp, i) => {
            console.log(`   ${i + 1}. ${chalk_1.default.bold(mp.path)}`);
            console.log(`       原因: ${chalk_1.default.yellow(mp.reason)}`);
            if (mp.actualLocation) {
                console.log(`       位置: ${chalk_1.default.gray(mp.actualLocation)}`);
            }
        });
        console.log('');
    }
    if (verbose) {
        console.log(chalk_1.default.bold('🟢 有效导出列表:'));
        const validExports = result.exports.filter(e => e.fileExists);
        if (validExports.length > 0) {
            validExports.forEach((exp, i) => {
                console.log(`   ${i + 1}. ${chalk_1.default.green(exp.exportPath)}`);
                console.log(`       → ${chalk_1.default.gray(exp.resolvedPath)}`);
                if (exp.conditions.length > 0) {
                    console.log(`       条件: ${chalk_1.default.cyan(exp.conditions.join(', '))}`);
                }
            });
        }
        else {
            console.log(chalk_1.default.gray('   (无有效导出)'));
        }
        console.log('');
        if (result.importExamples.length > 0) {
            console.log(chalk_1.default.bold('📝 导入样例:'));
            result.importExamples.forEach((ex, i) => {
                const status = ex.shouldWork ? chalk_1.default.green('✅') : chalk_1.default.red('❌');
                console.log(`   ${i + 1}. ${status} ${ex.importPath}`);
                if (!ex.shouldWork && ex.error) {
                    console.log(`       ${chalk_1.default.red(ex.error)}`);
                }
            });
            console.log('');
        }
    }
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
    if (hasIssues) {
        console.log(chalk_1.default.bold.red('════════════════════════════════════════════════════════════'));
        console.log(chalk_1.default.bold.red('           ❗ 检查未通过，请修复上述问题'));
        console.log(chalk_1.default.bold.red('════════════════════════════════════════════════════════════'));
    }
    else {
        console.log(chalk_1.default.bold.green('════════════════════════════════════════════════════════════'));
        console.log(chalk_1.default.bold.green('           ✓ 所有检查通过！'));
        console.log(chalk_1.default.bold.green('════════════════════════════════════════════════════════════'));
    }
    console.log('');
}
function writeJsonReport(result, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const filename = path.join(outputDir, 'exports-check-report.json');
    fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf-8');
    return filename;
}
function writeMarkdownReport(result, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const filename = path.join(outputDir, 'exports-check-report.md');
    const md = [];
    md.push('# Package Exports 体检报告');
    md.push('');
    md.push(`> 生成时间: ${result.checkedAt}`);
    md.push('');
    md.push('## 📦 包信息');
    md.push('');
    md.push('| 字段 | 值 |');
    md.push('|------|-----|');
    md.push(`| 包名称 | \`${result.packageName}\` |`);
    md.push(`| 版本 | \`${result.packageVersion}\` |`);
    md.push(`| 检查目录 | \`${result.packageDir}\` |`);
    md.push('');
    md.push('## 📊 摘要统计');
    md.push('');
    md.push('| 指标 | 数量 | 状态 |');
    md.push('|------|------|------|');
    md.push(`| 总导出入口 | ${result.summary.totalExports} | |`);
    md.push(`| 有效导出 | ${result.summary.validExports} | ✅ |`);
    md.push(`| 无效导出 | ${result.summary.invalidExports} | ${result.summary.invalidExports > 0 ? '❌' : '✅'} |`);
    md.push(`| 缺失文件 | ${result.summary.missingFiles} | ${result.summary.missingFiles > 0 ? '⚠️' : '✅'} |`);
    md.push(`| 扫描文件总数 | ${result.summary.totalFiles} | |`);
    md.push('');
    if (result.errors.length > 0) {
        md.push('## ❌ 错误');
        md.push('');
        result.errors.forEach((err, i) => {
            md.push(`${i + 1}. **${err}**`);
        });
        md.push('');
    }
    if (result.warnings.length > 0) {
        md.push('## ⚠️ 警告');
        md.push('');
        result.warnings.forEach((warn, i) => {
            md.push(`${i + 1}. ${warn}`);
        });
        md.push('');
    }
    const invalidExports = result.exports.filter(e => !e.fileExists);
    if (invalidExports.length > 0) {
        md.push('## 🔴 无效导出详情');
        md.push('');
        md.push('| 序号 | 导出路径 | 解析路径 | 条件 | 来源 | 错误 |');
        md.push('|------|----------|----------|------|------|------|');
        invalidExports.forEach((exp, i) => {
            md.push(`| ${i + 1} | \`${exp.exportPath}\` | \`${exp.resolvedPath || '(null)'}\` | ${exp.conditions.join(', ') || '-'} | ${exp.source} | ${exp.error || '文件不存在'} |`);
        });
        md.push('');
    }
    if (result.missingPaths.length > 0) {
        md.push('## 🟡 缺失路径详情');
        md.push('');
        md.push('| 序号 | 文件路径 | 原因 | 实际位置 |');
        md.push('|------|----------|------|----------|');
        result.missingPaths.forEach((mp, i) => {
            md.push(`| ${i + 1} | \`${mp.path}\` | ${mp.reason} | \`${mp.actualLocation || '-'}\` |`);
        });
        md.push('');
    }
    md.push('## 🟢 有效导出列表');
    md.push('');
    const validExports = result.exports.filter(e => e.fileExists);
    if (validExports.length > 0) {
        md.push('| 序号 | 导出路径 | 解析路径 | 条件 | 来源 |');
        md.push('|------|----------|----------|------|------|');
        validExports.forEach((exp, i) => {
            md.push(`| ${i + 1} | \`${exp.exportPath}\` | \`${exp.resolvedPath || '-'}\` | ${exp.conditions.join(', ') || '-'} | ${exp.source} |`);
        });
    }
    else {
        md.push('*(无有效导出)*');
    }
    md.push('');
    if (result.importExamples.length > 0) {
        md.push('## 📝 导入样例');
        md.push('');
        md.push('| 序号 | 导入语句 | 预期可用 | 实际路径 | 错误信息 |');
        md.push('|------|----------|----------|----------|----------|');
        result.importExamples.forEach((ex, i) => {
            md.push(`| ${i + 1} | \`${ex.importPath}\` | ${ex.shouldWork ? '✅ 是' : '❌ 否'} | \`${ex.actualPath || '-'}\` | ${ex.error || '-'} |`);
        });
        md.push('');
    }
    md.push('## 🔍 追溯信息');
    md.push('');
    md.push('### 文件位置追溯');
    md.push('');
    md.push('所有文件的绝对路径:');
    md.push('');
    result.files
        .filter(f => f.isFile)
        .slice(0, 50)
        .forEach(f => {
        md.push(`- \`${f.absolutePath}\``);
    });
    if (result.files.length > 50) {
        md.push(`- ... 还有 ${result.files.length - 50} 个文件`);
    }
    md.push('');
    md.push('---');
    md.push('');
    md.push('*此报告由 Package Exports Checker 自动生成*');
    fs.writeFileSync(filename, md.join('\n'), 'utf-8');
    return filename;
}
function generateReports(result, options) {
    const outputs = {};
    const shouldOutput = (format) => {
        return options.format.includes('all') || options.format.includes(format);
    };
    if (shouldOutput('json')) {
        outputs.json = writeJsonReport(result, options.outputDir);
    }
    if (shouldOutput('markdown')) {
        outputs.markdown = writeMarkdownReport(result, options.outputDir);
    }
    if (shouldOutput('terminal') || options.format.length === 0) {
        printTerminalSummary(result, options.verbose);
    }
    return outputs;
}
//# sourceMappingURL=reporter.js.map