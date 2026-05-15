#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const changeIndexService_1 = require("./services/changeIndexService");
const sampleData_1 = require("./data/sampleData");
const types_1 = require("./types");
const program = new commander_1.Command();
program
    .name('mrc')
    .description('多仓库变更索引命令行工具 - 高峰发票红冲记录管理')
    .version('1.0.0');
program
    .command('init')
    .description('初始化样例数据')
    .action(async () => {
    const db = await (0, changeIndexService_1.initDB)();
    await (0, sampleData_1.loadSampleData)(db);
    console.log('初始化完成！');
    process.exit(0);
});
program
    .command('list')
    .description('查询变更记录')
    .option('-b, --batch <batchId>', '按批次ID过滤')
    .option('-o, --operator <operator>', '按操作者过滤')
    .option('-r, --risk <riskType>', '按风险类型过滤')
    .option('-s, --status <status>', '按状态过滤')
    .action(async (options) => {
    await (0, changeIndexService_1.initDB)();
    const filter = {};
    if (options.batch)
        filter.batchId = options.batch;
    if (options.operator)
        filter.operator = options.operator;
    if (options.risk)
        filter.riskType = options.risk;
    if (options.status)
        filter.status = options.status;
    const records = (0, changeIndexService_1.queryRecords)(filter);
    if (records.length === 0) {
        console.log('未找到匹配的记录');
        process.exit(0);
    }
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                    多仓库变更索引 - 查询结果                         │');
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
    console.log(`共找到 ${records.length} 条记录\n`);
    records.forEach((record, index) => {
        console.log(`【记录 ${index + 1}】`);
        console.log(`  ID: ${record.id}`);
        console.log(`  发票号: ${record.invoiceNumber}`);
        console.log(`  批次: ${record.batchId.slice(0, 8)}...`);
        console.log(`  操作人: ${record.operator}`);
        console.log(`  风险类型: ${record.riskType}`);
        console.log(`  状态: ${record.status}`);
        console.log(`  当前节点: ${record.currentApprovalNode}`);
        console.log(`  金额: ¥${record.originalAmount.toFixed(2)} → ¥${record.redFlushAmount.toFixed(2)}`);
        console.log(`  归档路径: ${record.archivePath}`);
        if (record.failureReason) {
            console.log(`  失败原因: ${record.failureReason}`);
        }
        console.log(`  材料摘要: ${record.materialSummary}`);
        console.log(`  创建时间: ${new Date(record.createdAt).toLocaleString()}`);
        console.log();
    });
    process.exit(0);
});
program
    .command('batches')
    .description('查看所有批次')
    .action(async () => {
    await (0, changeIndexService_1.initDB)();
    const batches = (0, changeIndexService_1.getBatches)();
    if (batches.length === 0) {
        console.log('暂无批次数据');
        process.exit(0);
    }
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                        批次列表                                     │');
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
    batches.forEach((batch, index) => {
        console.log(`【批次 ${index + 1}】`);
        console.log(`  批次ID: ${batch.id}`);
        console.log(`  名称: ${batch.name}`);
        console.log(`  操作人: ${batch.operator}`);
        console.log(`  总记录: ${batch.totalRecords}`);
        console.log(`  成功: ${batch.successCount} | 失败: ${batch.failedCount}`);
        console.log(`  创建时间: ${new Date(batch.createdAt).toLocaleString()}`);
        console.log();
    });
    process.exit(0);
});
program
    .command('correct')
    .description('人工修正记录')
    .requiredOption('-i, --id <recordId>', '记录ID')
    .requiredOption('-f, --field <fieldName>', '要修正的字段名')
    .requiredOption('-o, --old <oldValue>', '原值')
    .requiredOption('-n, --new <newValue>', '新值')
    .requiredOption('-O, --operator <operator>', '操作人')
    .requiredOption('-m, --remark <remark>', '修正备注')
    .requiredOption('-a, --approval <approvalNode>', '审批节点')
    .action(async (options) => {
    await (0, changeIndexService_1.initDB)();
    try {
        await (0, changeIndexService_1.manualCorrect)(options.id, options.field, options.old, options.new, options.operator, options.remark, options.approval);
        console.log('人工修正成功！');
        console.log(`字段: ${options.field}`);
        console.log(`原值: ${options.old}`);
        console.log(`新值: ${options.new}`);
        console.log(`备注: ${options.remark}`);
    }
    catch (error) {
        console.error('修正失败:', error.message);
    }
    process.exit(0);
});
program
    .command('export')
    .description('导出记录')
    .option('-f, --format <format>', '导出格式: json|md', 'json')
    .option('-o, --output <outputDir>', '输出目录')
    .option('-b, --batch <batchId>', '按批次ID过滤')
    .option('-r, --risk <riskType>', '按风险类型过滤')
    .action(async (options) => {
    await (0, changeIndexService_1.initDB)();
    const filter = {};
    if (options.batch)
        filter.batchId = options.batch;
    if (options.risk)
        filter.riskType = options.risk;
    let content;
    let format;
    if (options.format === 'md' || options.format === 'markdown') {
        content = (0, changeIndexService_1.exportToMarkdown)(filter);
        format = 'md';
    }
    else {
        content = (0, changeIndexService_1.exportToJSON)(filter);
        format = 'json';
    }
    const filepath = (0, changeIndexService_1.saveExportFile)(content, format, options.output);
    console.log(`导出成功！文件路径: ${filepath}`);
    process.exit(0);
});
program
    .command('detail')
    .description('查看记录详情（含修正历史）')
    .requiredOption('-i, --id <recordId>', '记录ID')
    .action(async (options) => {
    await (0, changeIndexService_1.initDB)();
    const result = (0, changeIndexService_1.getRecordWithCorrections)(options.id);
    if (!result) {
        console.log('未找到该记录');
        process.exit(0);
    }
    const { record, corrections } = result;
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                        记录详情                                     │');
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
    console.log('【基本信息】');
    console.log(`  记录ID: ${record.id}`);
    console.log(`  发票号: ${record.invoiceNumber}`);
    console.log(`  批次ID: ${record.batchId}`);
    console.log(`  操作人: ${record.operator}`);
    console.log(`  风险类型: ${record.riskType}`);
    console.log(`  状态: ${record.status}`);
    console.log(`  当前审批节点: ${record.currentApprovalNode}`);
    console.log();
    console.log('【金额信息】');
    console.log(`  原金额: ¥${record.originalAmount.toFixed(2)}`);
    console.log(`  红冲金额: ¥${record.redFlushAmount.toFixed(2)}`);
    console.log();
    console.log('【文件信息】');
    console.log(`  归档路径: ${record.archivePath}`);
    console.log(`  材料摘要: ${record.materialSummary}`);
    if (record.failureReason) {
        console.log(`  失败原因: ${record.failureReason}`);
    }
    console.log();
    console.log('【短信发送清单】');
    if (record.smsRecords.length === 0) {
        console.log('  暂无短信记录');
    }
    else {
        record.smsRecords.forEach((sms, i) => {
            console.log(`  [${i + 1}] ${sms.phone} | ${sms.status} | ${new Date(sms.sendTime).toLocaleString()}`);
            console.log(`      内容: ${sms.content}`);
        });
    }
    console.log();
    console.log('【人工修正历史】');
    if (corrections.length === 0) {
        console.log('  暂无修正记录');
    }
    else {
        corrections.forEach((c, i) => {
            console.log(`  [${i + 1}] 字段: ${c.fieldName}`);
            console.log(`      原值: ${c.oldValue}`);
            console.log(`      新值: ${c.newValue}`);
            console.log(`      操作人: ${c.operator}`);
            console.log(`      备注: ${c.remark}`);
            console.log(`      审批节点: ${c.approvalNode}`);
            console.log(`      修正时间: ${new Date(c.correctedAt).toLocaleString()}`);
            console.log();
        });
    }
    process.exit(0);
});
program
    .command('history')
    .description('按审批节点回查修正历史')
    .option('-n, --node <approvalNode>', '审批节点')
    .action(async (options) => {
    await (0, changeIndexService_1.initDB)();
    if (options.node) {
        const records = (0, changeIndexService_1.queryRecords)({}).filter(r => r.currentApprovalNode === options.node);
        console.log(`\n审批节点 "${options.node}" 的记录:\n`);
        records.forEach((record, i) => {
            const corrections = (0, changeIndexService_1.getApprovalNodeHistory)(record.id);
            console.log(`[${i + 1}] ${record.invoiceNumber} - ${record.operator}`);
            console.log(`    修正次数: ${corrections.length}`);
            if (corrections.length > 0) {
                corrections.forEach((c, j) => {
                    console.log(`      [${j + 1}] ${c.fieldName}: ${c.oldValue} → ${c.newValue}`);
                    console.log(`          备注: ${c.remark}`);
                });
            }
            console.log();
        });
    }
    else {
        console.log('\n可用审批节点:');
        Object.values(types_1.ApprovalNode).forEach(node => {
            console.log(`  - ${node}`);
        });
        console.log();
    }
    process.exit(0);
});
program
    .command('risk-types')
    .description('查看所有风险类型')
    .action(() => {
    console.log('\n风险类型列表:');
    Object.values(types_1.RiskType).forEach(type => {
        console.log(`  - ${type}`);
    });
    console.log();
    process.exit(0);
});
program
    .command('statuses')
    .description('查看所有处理状态')
    .action(() => {
    console.log('\n处理状态列表:');
    Object.values(types_1.ProcessingStatus).forEach(status => {
        console.log(`  - ${status}`);
    });
    console.log();
    process.exit(0);
});
program.parseAsync(process.argv);
