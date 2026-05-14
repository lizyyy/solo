#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dataGenerator_1 = require("./services/dataGenerator");
const dataStore_1 = require("./store/dataStore");
const ruleEngine_1 = require("./services/ruleEngine");
const batchService_1 = require("./services/batchService");
const queryService_1 = require("./services/queryService");
const outputFormatter_1 = require("./services/outputFormatter");
const program = new commander_1.Command();
program
    .name('proc-audit')
    .description('采购询价单复核审计命令行工具')
    .version('1.0.0');
program
    .command('init-demo')
    .description('初始化演示数据')
    .action(() => {
    console.log('正在初始化演示数据...');
    dataGenerator_1.DataGenerator.initDemoData();
    console.log('✅ 演示数据初始化完成');
    console.log('已创建:');
    console.log(`  - ${dataStore_1.DataStore.getRules().length} 条规则`);
    console.log(`  - ${dataStore_1.DataStore.getInquiries().length} 条询价单`);
    console.log(`  - ${dataStore_1.DataStore.getPermissionTickets().length} 条权限临时票`);
});
program
    .command('list-inquiries')
    .description('列出询价单')
    .option('--batch-id <batchId>', '按批次筛选')
    .option('--status <status>', '按状态筛选')
    .option('--format <format>', '输出格式 (json|markdown)', 'json')
    .action((options) => {
    const result = queryService_1.QueryService.queryInquiries({
        batchId: options.batchId,
        status: options.status
    }, 1, 100);
    if (options.format === 'markdown') {
        let md = '# 询价单列表\n\n';
        md += `共 ${result.metadata?.total} 条记录\n\n`;
        md += '| 询价单号 | 标题 | 部门 | 申请人 | 总金额 | 状态 | 批次 |\n';
        md += '|----------|------|------|--------|--------|------|------|\n';
        for (const inquiry of result.data || []) {
            md += `| ${inquiry.inquiryNo} | ${inquiry.title} | ${inquiry.department} | ${inquiry.applicantName} | ¥${inquiry.totalAmount.toLocaleString()} | ${inquiry.status} | ${inquiry.batchId} |\n`;
        }
        console.log(md);
    }
    else {
        console.log(outputFormatter_1.OutputFormatter.toJSON(result));
    }
});
program
    .command('review')
    .description('复核询价单')
    .argument('<inquiryId>', '询价单ID')
    .option('--rule-version <version>', '指定规则版本')
    .option('--save', '保存复核结果')
    .action((inquiryId, options) => {
    const inquiry = dataStore_1.DataStore.getInquiryById(inquiryId);
    if (!inquiry) {
        console.error(`❌ 询价单 ${inquiryId} 不存在`);
        process.exit(1);
    }
    const ruleEngine = options.ruleVersion
        ? new ruleEngine_1.RuleEngine(options.ruleVersion)
        : new ruleEngine_1.RuleEngine();
    console.log(`使用规则版本: ${ruleEngine.getRuleVersion()}`);
    console.log(`规则描述: ${ruleEngine.getRuleDescription()}\n`);
    const result = ruleEngine.review(inquiry);
    if (options.save) {
        dataStore_1.DataStore.addReviewResult(result);
        console.log('✅ 复核结果已保存\n');
    }
    console.log(outputFormatter_1.OutputFormatter.toJSON(result));
});
program
    .command('batch-preview')
    .description('批量操作预览')
    .argument('<name>', '操作名称')
    .argument('<batchId>', '批次ID')
    .option('--type <type>', '操作类型 (review)', 'review')
    .action((name, batchId, options) => {
    const inquiries = dataStore_1.DataStore.getInquiriesByBatch(batchId);
    if (inquiries.length === 0) {
        console.error(`❌ 批次 ${batchId} 不存在或无数据`);
        process.exit(1);
    }
    const targetIds = inquiries.map(i => i.id);
    const operation = batchService_1.BatchService.createPreview(name, options.type, targetIds, 'cli-user');
    console.log('✅ 批量操作预览已创建\n');
    console.log(outputFormatter_1.OutputFormatter.toJSON(operation));
});
program
    .command('batch-execute')
    .description('执行批量操作')
    .argument('<operationId>', '批量操作ID')
    .action((operationId) => {
    try {
        const operation = batchService_1.BatchService.executeBatch(operationId);
        console.log('✅ 批量操作执行完成\n');
        console.log(outputFormatter_1.OutputFormatter.toJSON(operation));
    }
    catch (error) {
        console.error(`❌ 执行失败: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('generate-report')
    .description('生成报告')
    .argument('<inquiryId>', '询价单ID')
    .option('--output <path>', '输出文件路径')
    .option('--format <format>', '输出格式 (markdown|json)', 'markdown')
    .action((inquiryId, options) => {
    try {
        if (options.format === 'json') {
            const details = queryService_1.QueryService.getInquiryWithDetails(inquiryId);
            const content = outputFormatter_1.OutputFormatter.toJSON(details);
            if (options.output) {
                outputFormatter_1.OutputFormatter.saveToFile(content, options.output);
                console.log(`✅ 报告已保存到: ${options.output}`);
            }
            else {
                console.log(content);
            }
        }
        else {
            const report = outputFormatter_1.OutputFormatter.generateReport(inquiryId);
            if (options.output) {
                outputFormatter_1.OutputFormatter.saveToFile(report, options.output);
                console.log(`✅ 报告已保存到: ${options.output}`);
            }
            else {
                console.log(report);
            }
        }
    }
    catch (error) {
        console.error(`❌ 生成报告失败: ${error.message}`);
        process.exit(1);
    }
});
program
    .command('generate-batch-report')
    .description('生成批次报告')
    .argument('<batchId>', '批次ID')
    .option('--output <path>', '输出文件路径')
    .action((batchId, options) => {
    const report = outputFormatter_1.OutputFormatter.generateBatchReport(batchId);
    if (options.output) {
        outputFormatter_1.OutputFormatter.saveToFile(report, options.output);
        console.log(`✅ 批次报告已保存到: ${options.output}`);
    }
    else {
        console.log(report);
    }
});
program
    .command('query-results')
    .description('查询复核结果')
    .option('--batch-id <batchId>', '按批次筛选')
    .option('--status <status>', '按状态筛选 (success|warning|error)')
    .action((options) => {
    const result = queryService_1.QueryService.queryReviewResults({
        batchId: options.batchId,
        status: options.status
    }, 1, 100);
    console.log(outputFormatter_1.OutputFormatter.toJSON(result));
});
program
    .command('list-rules')
    .description('列出所有规则')
    .action(() => {
    const rules = dataStore_1.DataStore.getRules();
    console.log(outputFormatter_1.OutputFormatter.toJSON(rules));
});
program.parse();
