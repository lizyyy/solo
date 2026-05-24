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
const types_1 = require("./types");
const schema_diff_1 = require("./schema-diff");
const query_analyzer_1 = require("./query-analyzer");
const nullability_rules_1 = require("./nullability-rules");
const report_generator_1 = require("./report-generator");
const utils_1 = require("./utils");
const program = new commander_1.Command();
program
    .name('gql-null-drift')
    .description('GraphQL空值漂移检测CLI工具 - 检测字段从非空变为可空的变更对客户端的影响')
    .version('1.0.0');
program
    .command('check')
    .description('检测两个Schema版本之间的空值漂移')
    .requiredOption('--old-schema <path>', '旧版Schema文件路径 (.graphql, .gql, .json')
    .requiredOption('--new-schema <path>', '新版Schema文件路径 (.graphql, .gql, .json')
    .option('--queries <paths...>', '查询文档文件或目录路径')
    .option('-o, --output-dir <path>', '报告输出目录', './null-drift-reports')
    .option('-f, --format <formats...>', '输出格式: terminal, json, markdown, all', ['terminal', 'json', 'markdown'])
    .option('--fail-on <level>', '失败阈值: critical, high, medium, any, none', 'high')
    .option('--client-version <version>', '客户端版本号')
    .option('--field-filter <fields...>', '只检测指定的字段路径')
    .option('-v, --verbose', '显示详细信息')
    .option('-c, --config <path>', '配置文件路径')
    .action(async (options) => {
    try {
        const exitCode = await runCheck(options);
        process.exit(exitCode);
    }
    catch (error) {
        console.error('错误:', error.message);
        process.exit(types_1.ExitCode.INPUT_ERROR);
    }
});
program
    .command('self-test')
    .description('运行自检命令，验证工具功能完整性')
    .option('-o, --output-dir <path>', '测试报告输出目录', './self-test-results')
    .action(async (options) => {
    try {
        const selfTestModule = await Promise.resolve().then(() => __importStar(require('./self-test')));
        const exitCode = await selfTestModule.runSelfTest(options.outputDir);
        process.exit(exitCode);
    }
    catch (error) {
        console.error('自检失败:', error.message);
        process.exit(types_1.ExitCode.SELF_TEST_FAILED);
    }
});
program
    .command('explain <rule-code>')
    .description('解释空值漂移规则的详细说明')
    .action((ruleCode) => {
    const rulesModule = require('./nullability-rules');
    const rule = Object.values(rulesModule.NULLABILITY_RULES).find((r) => r.code === ruleCode.toUpperCase());
    if (rule) {
        console.log(`规则代码: ${rule.code}`);
        console.log(`规则名称: ${rule.name}`);
        console.log(`严重程度: ${rule.severity}`);
        console.log(`描述: ${rule.description}`);
        console.log(`客户端影响: ${rule.clientImpact}`);
        console.log(`修复优先级: ${rule.fixPriority}`);
    }
    else {
        console.log(`未找到规则: ${ruleCode}`);
    }
});
async function runCheck(options) {
    const config = (0, utils_1.loadConfigFile)(options.config);
    const mergedOptions = {
        oldSchema: options.oldSchema,
        newSchema: options.newSchema,
        queries: options.queries || config?.queryGlobs,
        outputDir: options.outputDir || config?.outputDir || './null-drift-reports',
        format: options.format,
        failOn: options.failOn || config?.failOn || 'high',
        clientVersion: options.clientVersion,
        fieldFilter: options.fieldFilter,
        verbose: options.verbose,
        config: options.config,
    };
    (0, utils_1.validateSchemaPath)(mergedOptions.oldSchema);
    (0, utils_1.validateSchemaPath)(mergedOptions.newSchema);
    console.log('📖 加载Schema...');
    const oldSchemaContent = (0, utils_1.readFile)(mergedOptions.oldSchema);
    const newSchemaContent = (0, utils_1.readFile)(mergedOptions.newSchema);
    const oldSchema = (0, schema_diff_1.loadSchema)(mergedOptions.oldSchema);
    const newSchema = (0, schema_diff_1.loadSchema)(mergedOptions.newSchema);
    console.log('🔍 对比Schema差异...');
    const { changes, summary, oldFields, newFields } = (0, schema_diff_1.compareSchemas)(oldSchema, newSchema);
    let filteredChanges = changes;
    if (mergedOptions.fieldFilter && mergedOptions.fieldFilter.length > 0) {
        const filterSet = new Set(mergedOptions.fieldFilter);
        filteredChanges = changes.filter((c) => filterSet.has(c.fieldPath));
    }
    let affectedQueries = [];
    let queryDocs = [];
    if (mergedOptions.queries && mergedOptions.queries.length > 0) {
        console.log('📄 加载查询文档...');
        const queryFiles = (0, utils_1.findQueryFiles)(mergedOptions.queries);
        if (queryFiles.length > 0) {
            queryDocs = (0, query_analyzer_1.loadQueryDocuments)(queryFiles);
            console.log(`   加载了 ${queryDocs.length} 个查询文档`);
            console.log('🔗 分析查询影响...');
            affectedQueries = (0, query_analyzer_1.analyzeQueryImpact)(queryDocs, filteredChanges, newFields);
        }
    }
    console.log('📊 生成失败路径...');
    const failurePaths = (0, nullability_rules_1.generateFailurePaths)(filteredChanges, affectedQueries);
    console.log('📝 生成报告...');
    const report = (0, report_generator_1.generateReport)(filteredChanges, affectedQueries, failurePaths, {
        oldSchemaHash: (0, utils_1.hashString)(oldSchemaContent),
        newSchemaHash: (0, utils_1.hashString)(newSchemaContent),
        clientVersion: mergedOptions.clientVersion,
        queriesScanned: queryDocs.length,
        fieldsScanned: summary.totalFieldsChecked,
    });
    const formats = mergedOptions.format.includes('all')
        ? ['terminal', 'json', 'markdown']
        : mergedOptions.format;
    if (formats.includes('terminal')) {
        (0, report_generator_1.printTerminalReport)(report, mergedOptions.verbose);
    }
    if (formats.includes('json')) {
        const jsonPath = (0, report_generator_1.writeJsonReport)(report, mergedOptions.outputDir);
        console.log(`JSON报告已保存: ${jsonPath}`);
    }
    if (formats.includes('markdown')) {
        const mdPath = (0, report_generator_1.writeMarkdownReport)(report, mergedOptions.outputDir);
        console.log(`Markdown报告已保存: ${mdPath}`);
    }
    const shouldFail = (0, nullability_rules_1.shouldFailBuild)(filteredChanges, mergedOptions.failOn);
    return shouldFail ? report.exitCode : types_1.ExitCode.SUCCESS;
}
program.parseAsync(process.argv).catch((error) => {
    console.error('命令执行失败:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map