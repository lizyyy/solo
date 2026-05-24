#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = require("path");
const fs_1 = require("fs");
const types_1 = require("./types");
const default_1 = require("./config/default");
const validator_1 = require("./utils/validator");
const errors_1 = require("./utils/errors");
const zoneParser_1 = require("./parsers/zoneParser");
const ttlAnalyzer_1 = require("./analyzers/ttlAnalyzer");
const environmentAnalyzer_1 = require("./analyzers/environmentAnalyzer");
const cnameAnalyzer_1 = require("./analyzers/cnameAnalyzer");
const generator_1 = require("./reporting/generator");
const program = new commander_1.Command();
program
    .name('r53-ttl')
    .description('Route53 TTL 分级分析工具 - 域名迁移前离线分析')
    .version('1.0.0');
program
    .command('analyze')
    .description('分析 Route53 Zone 文件的 TTL 配置')
    .requiredOption('-z, --zone-file <path>', 'Route53 Zone 导出文件路径 (支持 .zone, .json, .txt 格式)')
    .option('-d, --zone-dir <path>', '批量分析目录下的所有 Zone 文件')
    .option('-o, --output-dir <path>', '报告输出目录', default_1.DEFAULT_OUTPUT_DIR)
    .option('-e, --environments <names>', '指定要对比的环境列表，逗号分隔', (val) => val.split(','))
    .option('-w, --migration-window <hours>', '迁移窗口（小时），用于计算推荐 TTL')
    .option('-t, --ttl-config <path>', '自定义 TTL 分级配置文件 (JSON 格式)')
    .option('-E, --env-config <path>', '自定义环境匹配配置文件 (JSON 格式)')
    .option('-f, --format <formats>', '输出格式，逗号分隔: json,markdown,terminal', (val) => val.split(','), ['terminal'])
    .option('-v, --verbose', '显示详细输出', false)
    .option('-s, --strict', '严格模式，遇到警告也返回非零退出码', false)
    .option('--no-expand-cname', '不展开 CNAME 链路分析')
    .option('--max-chain-depth <number>', 'CNAME 链路最大展开深度', (val) => parseInt(val, 10), default_1.MAX_CNAME_CHAIN_DEPTH)
    .option('--min-ttl-warn <seconds>', '最小 TTL 警告阈值', (val) => parseInt(val, 10), default_1.DEFAULT_MIN_TTL_WARN)
    .option('--max-ttl-warn <seconds>', '最大 TTL 警告阈值', (val) => parseInt(val, 10), default_1.DEFAULT_MAX_TTL_WARN)
    .action(async (options) => {
    try {
        const startTime = Date.now();
        const normalizedOptions = {
            ...options,
            expandCNAME: options.expandCname !== undefined ? options.expandCname : true
        };
        let validatedOptions;
        try {
            validatedOptions = validator_1.cliOptionsSchema.parse(normalizedOptions);
        }
        catch (zodError) {
            const { ValidationError } = require('./utils/errors');
            throw new ValidationError(`参数无效: ${zodError.errors?.[0]?.message || zodError.message}`);
        }
        const outputDir = (0, path_1.resolve)(validatedOptions.outputDir);
        if (!(0, fs_1.existsSync)(outputDir)) {
            (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        }
        if (validatedOptions.verbose) {
            console.log(chalk_1.default.blue('ℹ️  开始分析 Route53 Zone 文件...'));
            console.log(chalk_1.default.gray(`   Zone 文件: ${validatedOptions.zoneFile}`));
            console.log(chalk_1.default.gray(`   输出目录: ${outputDir}`));
            if (validatedOptions.environments.length > 0) {
                console.log(chalk_1.default.gray(`   目标环境: ${validatedOptions.environments.join(', ')}`));
            }
            console.log('');
        }
        const zoneData = await (0, zoneParser_1.parseZoneFile)(validatedOptions.zoneFile);
        if (validatedOptions.verbose) {
            console.log(chalk_1.default.green(`✓ 成功解析 Zone 文件，共 ${zoneData.records.length} 条记录`));
            console.log('');
        }
        const environments = validatedOptions.environments.length > 0
            ? validatedOptions.environments
            : default_1.DEFAULT_ENVIRONMENTS.map(e => e.name);
        const ttlAnalysis = (0, ttlAnalyzer_1.analyzeTTL)(zoneData, validatedOptions);
        const environmentAnalysis = (0, environmentAnalyzer_1.analyzeEnvironments)(zoneData, environments, validatedOptions.envConfig);
        const cnameChains = validatedOptions.expandCNAME
            ? (0, cnameAnalyzer_1.analyzeCNAMEChains)(zoneData, validatedOptions.maxChainDepth)
            : [];
        const missingRecords = findMissingRecords(environmentAnalysis, environments);
        const result = {
            zone: zoneData,
            ttlAnalysis,
            environmentAnalysis,
            cnameChains,
            missingRecords,
            summary: generateSummary(zoneData, ttlAnalysis, environmentAnalysis, cnameChains, missingRecords)
        };
        await (0, generator_1.generateReports)(result, validatedOptions, outputDir);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('');
        console.log(chalk_1.default.green(`✓ 分析完成，耗时 ${duration} 秒`));
        const hasIssues = result.summary.needsAdjustment > 0 || result.summary.missingRecordsCount > 0;
        if (hasIssues) {
            console.log(chalk_1.default.yellow(`⚠️  发现 ${result.summary.needsAdjustment} 条 TTL 需调整记录，${result.summary.missingRecordsCount} 条缺失记录`));
            process.exit(validatedOptions.strict ? types_1.EXIT_CODES.WARNING_ISSUES_FOUND : types_1.EXIT_CODES.SUCCESS);
        }
        else {
            console.log(chalk_1.default.green('✓ 未发现严重问题'));
            process.exit(types_1.EXIT_CODES.SUCCESS);
        }
    }
    catch (error) {
        handleError(error, options.verbose);
    }
});
program
    .command('list-formats')
    .description('列出支持的 Zone 文件格式')
    .action(() => {
    console.log(chalk_1.default.cyan('支持的 Zone 文件格式:'));
    console.log('');
    console.log('  1. BIND Zone 格式 (.zone) - 标准 DNS Zone 文件格式');
    console.log('  2. JSON 格式 (.json) - AWS Route53 导出的 JSON 格式');
    console.log('  3. 文本格式 (.txt) - 每行一条记录的纯文本格式');
    console.log('');
});
program
    .command('list-tiers')
    .description('列出默认的 TTL 分级配置')
    .action(() => {
    const { DEFAULT_TTL_TIERS } = require('./config/default');
    console.log(chalk_1.default.cyan('默认 TTL 分级配置:'));
    console.log('');
    for (const tier of DEFAULT_TTL_TIERS) {
        const colorFn = chalk_1.default[tier.color] || chalk_1.default.white;
        console.log(`  ${colorFn(tier.tier.padEnd(10))} ${tier.min}s - ${tier.max === Infinity ? '∞' : tier.max + 's'} : ${tier.description}`);
    }
    console.log('');
});
program
    .command('list-envs')
    .description('列出默认的环境匹配规则')
    .action(() => {
    const { DEFAULT_ENVIRONMENTS } = require('./config/default');
    console.log(chalk_1.default.cyan('默认环境匹配规则:'));
    console.log('');
    for (const env of DEFAULT_ENVIRONMENTS) {
        const colorFn = chalk_1.default[env.color] || chalk_1.default.white;
        console.log(`  ${colorFn(env.name.padEnd(15))} 匹配模式: ${env.patterns.join(', ')}`);
    }
    console.log('');
});
program
    .command('init-config')
    .description('生成示例配置文件')
    .option('-o, --output-dir <path>', '输出目录', '.')
    .action((options) => {
    const { writeFileSync } = require('fs');
    const { DEFAULT_TTL_TIERS, DEFAULT_ENVIRONMENTS } = require('./config/default');
    const ttlConfigPath = (0, path_1.join)(options.outputDir, 'ttl-config.example.json');
    const envConfigPath = (0, path_1.join)(options.outputDir, 'env-config.example.json');
    writeFileSync(ttlConfigPath, JSON.stringify(DEFAULT_TTL_TIERS, null, 2));
    writeFileSync(envConfigPath, JSON.stringify(DEFAULT_ENVIRONMENTS, null, 2));
    console.log(chalk_1.default.green(`✓ 已生成示例配置文件:`));
    console.log(`  - ${ttlConfigPath}`);
    console.log(`  - ${envConfigPath}`);
    console.log('');
});
function generateSummary(zoneData, ttlAnalysis, environmentAnalysis, cnameChains, missingRecords) {
    const byTier = {};
    const byType = {};
    const byEnvironment = {};
    let needsAdjustment = 0;
    let totalTTL = 0;
    let maxTTL = 0;
    let minTTL = Infinity;
    for (const analysis of ttlAnalysis) {
        const tier = analysis.tier;
        byTier[tier] = (byTier[tier] || 0) + 1;
        if (analysis.needsAdjustment)
            needsAdjustment++;
    }
    for (const record of zoneData.records) {
        const type = record.type;
        byType[type] = (byType[type] || 0) + 1;
        totalTTL += record.ttl;
        maxTTL = Math.max(maxTTL, record.ttl);
        minTTL = Math.min(minTTL, record.ttl);
    }
    for (const envRecord of environmentAnalysis) {
        for (const env of envRecord.environments) {
            byEnvironment[env] = (byEnvironment[env] || 0) + 1;
        }
    }
    return {
        totalRecords: zoneData.records.length,
        byTier,
        byType,
        byEnvironment,
        needsAdjustment,
        cnameChainsCount: cnameChains.length,
        missingRecordsCount: missingRecords.length,
        averageTTL: zoneData.records.length > 0 ? Math.round(totalTTL / zoneData.records.length) : 0,
        maxTTL,
        minTTL: minTTL === Infinity ? 0 : minTTL
    };
}
function findMissingRecords(environmentAnalysis, environments) {
    const missing = [];
    const envPrefixes = {
        production: ['prod-', 'production-'],
        staging: ['stg-', 'staging-', 'stage-'],
        testing: ['test-', 'testing-', 'tst-', 'qa-'],
        development: ['dev-', 'development-', 'local-'],
        internal: ['int-', 'internal-'],
        monitoring: ['mon-', 'monitor-']
    };
    const baseNameToEnvToRecord = new Map();
    for (const envRecord of environmentAnalysis) {
        const record = envRecord.record;
        const nameLower = record.name.toLowerCase();
        for (const [env, prefixes] of Object.entries(envPrefixes)) {
            for (const prefix of prefixes) {
                if (nameLower.startsWith(prefix)) {
                    const baseName = nameLower.slice(prefix.length);
                    const fullKey = `${baseName}:${record.type}`;
                    if (!baseNameToEnvToRecord.has(fullKey)) {
                        baseNameToEnvToRecord.set(fullKey, new Map());
                    }
                    baseNameToEnvToRecord.get(fullKey).set(env, { name: record.name, type: record.type });
                    break;
                }
            }
        }
    }
    for (const [fullKey, envToRecord] of baseNameToEnvToRecord) {
        const [baseName, type] = fullKey.split(':');
        const foundEnvs = Array.from(envToRecord.keys());
        for (const env of environments) {
            const prefixes = envPrefixes[env] || [];
            if (prefixes.length === 0)
                continue;
            if (!envToRecord.has(env) && foundEnvs.length > 0) {
                const sampleRecord = envToRecord.get(foundEnvs[0]);
                missing.push({
                    environment: env,
                    recordName: `${prefixes[0]}${baseName}`,
                    type: sampleRecord?.type || type,
                    foundInEnvironments: foundEnvs
                });
            }
        }
    }
    return missing;
}
function handleError(error, verbose) {
    console.error('');
    if (error instanceof errors_1.CLIError) {
        console.error(chalk_1.default.red(`✗ 错误: ${error.message}`));
        if (verbose && error.stack) {
            console.error(chalk_1.default.gray(error.stack));
        }
        console.error('');
        process.exit(error.exitCode);
    }
    if (error instanceof Error) {
        console.error(chalk_1.default.red(`✗ 错误: ${error.message}`));
        if (verbose && error.stack) {
            console.error(chalk_1.default.gray(error.stack));
        }
    }
    else {
        console.error(chalk_1.default.red(`✗ 未知错误: ${error}`));
    }
    console.error('');
    process.exit(types_1.EXIT_CODES.ERROR_ANALYSIS_FAILED);
}
program.parseAsync(process.argv).catch((err) => handleError(err, false));
//# sourceMappingURL=cli.js.map