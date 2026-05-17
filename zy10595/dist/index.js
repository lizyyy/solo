#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const openapi_parser_1 = require("./openapi-parser");
const source_scanner_1 = require("./source-scanner");
const enum_comparator_1 = require("./enum-comparator");
const report_generator_1 = require("./report-generator");
const program = new commander_1.Command();
program
    .name('api-enum')
    .description('API 枚举契约检查工具 - 对比 OpenAPI 文档与源代码中的枚举值差异')
    .version('1.0.0');
program
    .command('check')
    .description('检查 OpenAPI 与源代码中的枚举差异')
    .requiredOption('--openapi <paths...>', 'OpenAPI 文件路径（支持多个）')
    .requiredOption('--source <paths...>', '源代码路径（支持多个）')
    .option('--enum-names <names...>', '指定要检查的枚举名称（默认检查所有）')
    .option('-o, --output <path>', '报告输出文件路径')
    .option('-f, --format <format>', '输出格式: terminal, json, markdown', 'terminal')
    .option('--no-fail-on-error', '即使发现差异也不返回非零退出码')
    .option('--keep-bad-entries', '保留异常条目不中断处理（默认开启）')
    .action(async (options) => {
    await runCheck(options);
});
program
    .command('list')
    .description('列出所有检测到的枚举')
    .requiredOption('--openapi <paths...>', 'OpenAPI 文件路径（支持多个）')
    .requiredOption('--source <paths...>', '源代码路径（支持多个）')
    .option('--format <format>', '输出格式: terminal, json', 'terminal')
    .action(async (options) => {
    await listEnums(options);
});
async function runCheck(options) {
    const openapiParser = new openapi_parser_1.OpenApiParser();
    const sourceScanner = new source_scanner_1.SourceScanner();
    const enumComparator = new enum_comparator_1.EnumComparator();
    const reportGenerator = new report_generator_1.ReportGenerator();
    let openapiEnums = [];
    let sourceEnums = [];
    let badEntries = [];
    const errors = [];
    for (const openapiPath of options.openapi) {
        try {
            const result = openapiParser.parseFile(openapiPath);
            openapiEnums = [...openapiEnums, ...result.enums];
            badEntries = [...badEntries, ...result.badEntries];
        }
        catch (e) {
            errors.push({
                filePath: openapiPath,
                error: e.message,
                timestamp: new Date()
            });
        }
    }
    for (const sourcePath of options.source) {
        try {
            const result = sourceScanner.scanFiles([sourcePath]);
            sourceEnums = [...sourceEnums, ...result.enums];
            badEntries = [...badEntries, ...result.badEntries];
        }
        catch (e) {
            errors.push({
                filePath: sourcePath,
                error: e.message,
                timestamp: new Date()
            });
        }
    }
    let differences;
    if (options.enumNames && options.enumNames.length > 0) {
        differences = enumComparator.compareByName(openapiEnums, sourceEnums, options.enumNames);
    }
    else {
        differences = enumComparator.compare(openapiEnums, sourceEnums);
    }
    const matchingEnums = enumComparator.getMatchingEnums(openapiEnums, sourceEnums);
    const report = {
        summary: {
            totalEnums: new Set([...openapiEnums.map(e => e.name), ...sourceEnums.map(e => e.name)]).size,
            matchedEnums: matchingEnums.length,
            mismatchedEnums: differences.length,
            totalBadEntries: badEntries.length,
            errors: errors.length,
            warnings: badEntries.filter(e => e.severity === 'warning').length
        },
        differences,
        badEntries,
        errors,
        timestamp: new Date(),
        metadata: {
            openApiFiles: options.openapi,
            sourceFiles: options.source
        }
    };
    let outputReport;
    switch (options.format) {
        case 'json':
            outputReport = reportGenerator.generateJsonReport(report);
            break;
        case 'markdown':
            outputReport = reportGenerator.generateMarkdownReport(report);
            break;
        default:
            outputReport = reportGenerator.generateTerminalReport(report);
    }
    if (options.output) {
        reportGenerator.saveReport(outputReport, options.output);
        console.log(`报告已保存到: ${options.output}`);
    }
    else {
        console.log(outputReport);
    }
    const exitCode = reportGenerator.getExitCode(report, options.failOnError !== false);
    process.exit(exitCode);
}
async function listEnums(options) {
    const openapiParser = new openapi_parser_1.OpenApiParser();
    const sourceScanner = new source_scanner_1.SourceScanner();
    let openapiEnums = [];
    let sourceEnums = [];
    for (const openapiPath of options.openapi) {
        try {
            const result = openapiParser.parseFile(openapiPath);
            openapiEnums = [...openapiEnums, ...result.enums];
        }
        catch (e) {
            console.error(`解析 OpenAPI 文件失败: ${openapiPath} - ${e.message}`);
        }
    }
    for (const sourcePath of options.source) {
        try {
            const result = sourceScanner.scanFiles([sourcePath]);
            sourceEnums = [...sourceEnums, ...result.enums];
        }
        catch (e) {
            console.error(`扫描源代码失败: ${sourcePath} - ${e.message}`);
        }
    }
    if (options.format === 'json') {
        console.log(JSON.stringify({
            openapi: openapiEnums.map(e => ({ name: e.name, values: e.values.map(v => v.value), filePath: e.filePath })),
            source: sourceEnums.map(e => ({ name: e.name, values: e.values.map(v => v.value), filePath: e.filePath }))
        }, null, 2));
    }
    else {
        console.log('\n📄 OpenAPI 文档中的枚举:');
        openapiEnums.forEach(e => {
            console.log(`  - ${e.name} (${e.filePath})`);
            console.log(`    值: ${e.values.map(v => v.value).join(', ')}`);
        });
        console.log('\n💻 源代码中的枚举:');
        sourceEnums.forEach(e => {
            console.log(`  - ${e.name} (${e.filePath})`);
            console.log(`    值: ${e.values.map(v => v.value).join(', ')}`);
        });
        console.log('');
    }
}
program.parse();
