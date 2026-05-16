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
const dataGenerator_1 = require("./dataGenerator");
const auditEngine_1 = require("./auditEngine");
const output_1 = require("./output");
const rules_1 = require("./rules");
const path = __importStar(require("path"));
const program = new commander_1.Command();
program
    .name('bsa')
    .description('批量脚本执行审计命令行工具')
    .version('1.0.0');
program
    .command('audit')
    .description('执行批量审计')
    .option('-c, --count <number>', '样本数量', '10')
    .option('-r, --rule-version <version>', '规则版本')
    .option('-f, --format <format>', '输出格式: json|markdown|download', 'markdown')
    .option('-o, --output <dir>', '输出目录', './audit-reports')
    .option('--no-save', '不保存文件，仅控制台输出')
    .action(async (options) => {
    try {
        const count = parseInt(options.count, 10);
        const batchId = `CLI-${Date.now()}`;
        console.log(`正在生成 ${count} 个实验室样本...`);
        const samples = (0, dataGenerator_1.generateLaboratorySamples)(batchId, count);
        console.log(`已生成 ${samples.length} 个样本（含重复提交案例）`);
        console.log('开始执行审计...');
        const result = (0, auditEngine_1.auditBatch)(samples, options.ruleVersion);
        console.log((0, output_1.formatConsoleOutput)(result));
        if (options.save) {
            const outputDir = path.resolve(process.cwd(), options.output);
            const saved = (0, output_1.saveReport)(result, options.format, outputDir);
            console.log('\n报告已保存:');
            console.log(`  报告路径: ${saved.reportPath}`);
            if (saved.failedItemsPath) {
                console.log(`  失败项: ${saved.failedItemsPath}`);
            }
        }
    }
    catch (error) {
        console.error('执行失败:', error);
        process.exit(1);
    }
});
program
    .command('query')
    .description('查询审计结果')
    .option('-s, --status <status>', '按状态过滤: success|warning|failed')
    .option('-n, --sample-no <no>', '按样本号模糊查询')
    .option('-r, --rule-id <id>', '按规则ID查询')
    .option('-c, --count <number>', '样本数量', '10')
    .option('-f, --format <format>', '输出格式: json|markdown', 'json')
    .action(async (options) => {
    try {
        const count = parseInt(options.count, 10);
        const batchId = `QUERY-${Date.now()}`;
        const samples = (0, dataGenerator_1.generateLaboratorySamples)(batchId, count);
        const result = (0, auditEngine_1.auditBatch)(samples);
        let records;
        if (options.status) {
            records = (0, auditEngine_1.queryRecordsByStatus)(result, options.status);
            console.log(`按状态 ${options.status} 查询，共 ${records.length} 条记录:`);
        }
        else if (options.sampleNo) {
            records = (0, auditEngine_1.queryRecordsBySampleNo)(result, options.sampleNo);
            if (records) {
                console.log(`找到样本号 ${options.sampleNo} 的记录:`);
                records = [records];
            }
            else {
                console.log(`未找到样本号为 ${options.sampleNo} 的记录`);
                return;
            }
        }
        else if (options.ruleId) {
            records = (0, auditEngine_1.queryRecordsByRuleId)(result, options.ruleId);
            console.log(`按规则 ${options.ruleId} 查询，共 ${records.length} 条失败记录:`);
        }
        else {
            records = result.records;
            console.log(`查询全部记录，共 ${records.length} 条:`);
        }
        if (options.format === 'json') {
            console.log(JSON.stringify(records, null, 2));
        }
        else {
            records.forEach((record) => {
                console.log(`\n样本号: ${record.sampleNo}`);
                console.log(`状态: ${record.overallStatus}`);
                record.checks.forEach((check) => {
                    const icon = check.result.passed ? '✓' : '✗';
                    console.log(`  ${icon} ${check.ruleName}: ${check.result.message}`);
                });
            });
        }
    }
    catch (error) {
        console.error('查询失败:', error);
        process.exit(1);
    }
});
program
    .command('rules')
    .description('查看规则版本历史')
    .action(() => {
    const versions = (0, rules_1.getRuleVersionHistory)();
    console.log('可用规则版本:');
    versions.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v}`);
    });
});
program
    .command('demo')
    .description('运行完整演示')
    .action(async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           批量脚本执行审计工具 - 完整演示                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    const batchId = `DEMO-${Date.now()}`;
    console.log('1. 生成实验室样本数据...');
    const samples = (0, dataGenerator_1.generateLaboratorySamples)(batchId, 8);
    console.log(`   ✓ 生成 ${samples.length} 个样本，包含：`);
    console.log(`     - 1例重复提交`);
    console.log(`     - 1例网关错误`);
    console.log(`     - 1例格式错误\n`);
    console.log('2. 使用最新规则版本执行审计...');
    const resultV1 = (0, auditEngine_1.auditBatch)(samples, 'v1.1.0');
    console.log(`   ✓ 审计完成，耗时 ${resultV1.executionTimeMs}ms`);
    console.log(`   ✓ 成功: ${resultV1.successCount}, 警告: ${resultV1.warningCount}, 失败: ${resultV1.failedCount}\n`);
    console.log('3. 演示规则版本兼容性 - 使用旧版本规则 v1.0.0...');
    const resultV0 = (0, auditEngine_1.auditBatch)(samples, 'v1.0.0');
    console.log(`   ✓ 使用旧规则审计完成`);
    console.log(`   ✓ 规则版本变更不影响历史批次解释口径\n`);
    console.log('4. 保存多格式报告...');
    const outputDir = path.resolve(process.cwd(), 'audit-reports');
    const jsonResult = (0, output_1.saveReport)(resultV1, 'json', outputDir);
    const mdResult = (0, output_1.saveReport)(resultV1, 'markdown', outputDir);
    console.log(`   ✓ JSON 报告: ${jsonResult.reportPath}`);
    console.log(`   ✓ Markdown 报告: ${mdResult.reportPath}`);
    if (jsonResult.failedItemsPath) {
        console.log(`   ✓ 失败项单独保存: ${jsonResult.failedItemsPath}`);
    }
    console.log('');
    console.log('5. 统一查询接口演示:');
    const failedRecords = (0, auditEngine_1.queryRecordsByStatus)(resultV1, 'failed');
    console.log(`   ✓ 失败样本查询: ${failedRecords.length} 条`);
    const duplicateRecords = (0, auditEngine_1.queryRecordsByRuleId)(resultV1, 'R002');
    console.log(`   ✓ 重复提交查询: ${duplicateRecords.length} 条\n`);
    console.log((0, output_1.formatConsoleOutput)(resultV1));
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                     演示完成！                              ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
});
program.parseAsync(process.argv);
