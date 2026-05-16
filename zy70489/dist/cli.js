#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("./database");
const prober_1 = require("./prober");
const inquiryProcessor_1 = require("./inquiryProcessor");
const program = new commander_1.Command();
const db = new database_1.Database();
const prober = new prober_1.Prober(db);
const processor = new inquiryProcessor_1.InquiryProcessor(db);
program
    .name('probe')
    .description('依赖探活命令行工具')
    .version('1.0.0');
program
    .command('probe-dns')
    .description('DNS探活')
    .requiredOption('--host <host>', '域名')
    .option('--timeout <ms>', '超时时间(毫秒)', '5000')
    .action(async (options) => {
    try {
        const result = await prober.probeDNS(options.host, parseInt(options.timeout));
        printProbeResult(result);
        db.close();
        process.exit(result.status === 'success' ? 0 : 1);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('probe-tcp')
    .description('TCP端口探活')
    .requiredOption('--host <host>', '主机地址')
    .requiredOption('--port <port>', '端口号')
    .option('--timeout <ms>', '超时时间(毫秒)', '5000')
    .action(async (options) => {
    try {
        const result = await prober.probeTCP(options.host, parseInt(options.port), parseInt(options.timeout));
        printProbeResult(result);
        db.close();
        process.exit(result.status === 'success' ? 0 : 1);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('probe-http')
    .description('HTTP服务探活')
    .requiredOption('--url <url>', 'URL地址')
    .option('--timeout <ms>', '超时时间(毫秒)', '5000')
    .option('--expected-status <code>', '期望状态码', '200')
    .action(async (options) => {
    try {
        const result = await prober.probeHTTP(options.url, parseInt(options.timeout), parseInt(options.expectedStatus));
        printProbeResult(result);
        db.close();
        process.exit(result.status === 'success' ? 0 : 1);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('init-data')
    .description('初始化采购询价单测试数据')
    .action(async () => {
    try {
        const inquiries = await processor.generateMockData();
        console.log(chalk_1.default.green('✓ 成功初始化测试数据'));
        console.log(`共生成 ${inquiries.length} 条采购询价单:\n`);
        inquiries.forEach((inq, index) => {
            console.log(`${index + 1}. ${chalk_1.default.cyan(inq.inquiryNo)} - ${inq.supplier}`);
            console.log(`   ${inq.materialName}`);
            console.log(`   数量: ${inq.quantity}, 总价: ¥${inq.totalPrice.toFixed(2)}`);
            console.log(`   状态: ${formatStatus(inq.status)}\n`);
        });
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('concurrent-test')
    .description('并发写入测试')
    .requiredOption('--id <inquiryId>', '询价单ID')
    .option('--count <number>', '并发数量', '3')
    .action(async (options) => {
    try {
        await processor.simulateConcurrentWrite(options.id, parseInt(options.count));
        console.log(chalk_1.default.green('✓ 并发写入测试完成'));
        console.log(chalk_1.default.yellow(`⚠️ 注意: 询价单 ${options.id} 的状态和权限票可能已被覆盖\n`));
        const conclusions = await processor.getConclusions(options.id);
        console.log(`处理记录 (共${conclusions.length}条):`);
        conclusions.forEach((c, index) => {
            console.log(`${index + 1}. 结论: ${formatConclusion(c.conclusion)}`);
            console.log(`   原因: ${c.reason}`);
            if (c.isManualCorrection) {
                console.log(`   ${chalk_1.default.magenta('(人工修正) 备注: ' + c.correctionRemark)}`);
            }
            console.log();
        });
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('process')
    .description('处理询价单')
    .requiredOption('--id <inquiryId>', '询价单ID')
    .requiredOption('--conclusion <conclusion>', '结论: pass/fail/review')
    .requiredOption('--reason <reason>', '处理原因')
    .action(async (options) => {
    try {
        const conclusion = await processor.processInquiry(options.id, options.conclusion, options.reason);
        console.log(chalk_1.default.green('✓ 处理成功'));
        console.log(`结论: ${formatConclusion(conclusion.conclusion)}`);
        console.log(`原因: ${conclusion.reason}\n`);
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('correct')
    .description('人工修正处理结论')
    .requiredOption('--id <inquiryId>', '询价单ID')
    .requiredOption('--conclusion <conclusion>', '新结论: pass/fail/review')
    .requiredOption('--reason <reason>', '新原因')
    .requiredOption('--operator <operator>', '操作人')
    .requiredOption('--remark <remark>', '修正备注')
    .option('--permission-ticket <ticket>', '新的权限临时票(可选)')
    .action(async (options) => {
    try {
        const conclusion = await processor.manualCorrect(options.id, options.conclusion, options.reason, options.operator, options.remark, options.permissionTicket);
        console.log(chalk_1.default.green('✓ 人工修正成功'));
        console.log(chalk_1.default.magenta('⚠️ 这是人工修正记录，保留了历史变更痕迹'));
        console.log(`新结论: ${formatConclusion(conclusion.conclusion)}`);
        console.log(`新原因: ${conclusion.reason}`);
        console.log(`操作人: ${conclusion.operator}`);
        console.log(`备注: ${conclusion.correctionRemark}`);
        if (conclusion.previousConclusion) {
            console.log(`\n历史记录:`);
            console.log(`  之前结论: ${formatConclusion(conclusion.previousConclusion)}`);
            console.log(`  之前原因: ${conclusion.previousReason}`);
        }
        if (conclusion.newPermissionTicket !== undefined) {
            console.log(`\n权限临时票变更:`);
            console.log(`  变更前: ${conclusion.previousPermissionTicket || '无'}`);
            console.log(`  变更后: ${conclusion.newPermissionTicket || '无'}`);
        }
        console.log();
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('summary')
    .description('生成询价单摘要')
    .requiredOption('--id <inquiryId>', '询价单ID')
    .action(async (options) => {
    try {
        const summary = await processor.generateSummary(options.id);
        console.log(chalk_1.default.cyan('=' + '='.repeat(50)));
        console.log(summary.summary);
        console.log(chalk_1.default.cyan('=' + '='.repeat(50)));
        console.log();
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('query-probes')
    .description('查询探活结果')
    .option('--status <status>', '状态筛选: success/failure/all')
    .option('--dependency-id <id>', '依赖ID')
    .action(async (options) => {
    try {
        const filter = {};
        if (options.status)
            filter.status = options.status;
        if (options.dependencyId)
            filter.dependencyId = options.dependencyId;
        const results = await db.queryProbeResults(filter);
        console.log(chalk_1.default.cyan(`探活结果查询 (共${results.length}条):\n`));
        results.forEach((result, index) => {
            printProbeResult(result, index + 1);
        });
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('list-inquiries')
    .description('列出所有询价单')
    .action(async () => {
    try {
        const inquiries = await processor.getAllInquiries();
        console.log(chalk_1.default.cyan(`采购询价单列表 (共${inquiries.length}条):\n`));
        inquiries.forEach((inq, index) => {
            console.log(`${index + 1}. ID: ${chalk_1.default.yellow(inq.id)}`);
            console.log(`   询价单号: ${chalk_1.default.cyan(inq.inquiryNo)}`);
            console.log(`   供应商: ${inq.supplier}`);
            console.log(`   材料: ${inq.materialName}`);
            console.log(`   状态: ${formatStatus(inq.status)}`);
            console.log(`   权限票: ${inq.permissionTicket || '无'}\n`);
        });
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('list-summaries')
    .description('列出所有摘要')
    .action(async () => {
    try {
        const summaries = await processor.getAllSummaries();
        console.log(chalk_1.default.cyan(`材料摘要列表 (共${summaries.length}条):\n`));
        summaries.forEach((summary, index) => {
            console.log(`${index + 1}. 询价单ID: ${chalk_1.default.yellow(summary.inquiryId)}`);
            console.log(summary.summary);
            console.log(chalk_1.default.cyan('-'.repeat(50)));
            console.log();
        });
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('list-overview')
    .description('统一查看所有询价单的处理状态概览')
    .action(async () => {
    try {
        const overview = await processor.getAllInquiriesWithStatus();
        console.log(chalk_1.default.cyan(`采购询价单处理状态概览 (共${overview.length}条):\n`));
        overview.forEach((item, index) => {
            const { inquiry, conclusionsCount, hasManualCorrection, hasSummary } = item;
            console.log(`${index + 1}. ${chalk_1.default.cyan(inquiry.inquiryNo)} - ${inquiry.supplier}`);
            console.log(`   ID: ${chalk_1.default.yellow(inquiry.id)}`);
            console.log(`   状态: ${formatStatus(inquiry.status)}`);
            console.log(`   处理记录数: ${conclusionsCount}`);
            console.log(`   人工修正: ${hasManualCorrection ? chalk_1.default.magenta('是') : '否'}`);
            console.log(`   摘要: ${hasSummary ? chalk_1.default.green('已生成') : '未生成'}`);
            if (inquiry.permissionTicket) {
                const isConcurrent = inquiry.permissionTicket.includes('CONCURRENT');
                console.log(`   权限票: ${isConcurrent ? chalk_1.default.yellow(inquiry.permissionTicket) : inquiry.permissionTicket}`);
            }
            console.log();
        });
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
program
    .command('query-history')
    .description('查看询价单完整处理历史（包含成功/异常路径）')
    .requiredOption('--id <inquiryId>', '询价单ID')
    .action(async (options) => {
    try {
        const { inquiry, conclusions, summary } = await processor.getInquiryFullHistory(options.id);
        if (!inquiry) {
            console.error(chalk_1.default.red(`错误: 询价单 ${options.id} 不存在`));
            db.close();
            process.exit(1);
        }
        console.log(chalk_1.default.cyan('='.repeat(60)));
        console.log(chalk_1.default.bold(`询价单完整处理历史 - ${inquiry.inquiryNo}`));
        console.log(chalk_1.default.cyan('='.repeat(60)));
        console.log();
        console.log(chalk_1.default.bold('【基本信息】'));
        console.log(`供应商: ${inquiry.supplier}`);
        console.log(`材料: ${inquiry.materialName}`);
        console.log(`数量: ${inquiry.quantity}, 总价: ¥${inquiry.totalPrice.toFixed(2)}`);
        console.log(`当前状态: ${formatStatus(inquiry.status)}`);
        if (inquiry.permissionTicket) {
            const isConcurrent = inquiry.permissionTicket.includes('CONCURRENT');
            console.log(`权限票: ${isConcurrent ? chalk_1.default.yellow(inquiry.permissionTicket) : inquiry.permissionTicket}`);
        }
        console.log();
        console.log(chalk_1.default.bold(`【处理记录】 (共${conclusions.length}条)`));
        conclusions.forEach((conclusion, index) => {
            const isManual = conclusion.isManualCorrection;
            const prefix = isManual ? chalk_1.default.magenta('[人工修正]') : '[系统处理]';
            console.log(`${index + 1}. ${prefix} ${formatConclusion(conclusion.conclusion)}`);
            console.log(`   原因: ${conclusion.reason}`);
            console.log(`   时间: ${new Date(conclusion.createdAt).toLocaleString()}`);
            if (isManual && conclusion.operator) {
                console.log(`   操作人: ${conclusion.operator}`);
                console.log(`   备注: ${conclusion.correctionRemark}`);
            }
            if (conclusion.previousPermissionTicket !== undefined || conclusion.newPermissionTicket !== undefined) {
                console.log(`   权限票变更: ${conclusion.previousPermissionTicket || '无'} → ${conclusion.newPermissionTicket || '无'}`);
            }
            const manualCount = conclusions.filter(c => c.isManualCorrection).length;
            const systemCount = conclusions.filter(c => !c.isManualCorrection).length;
            if (!isManual && systemCount === 1 && manualCount === 0) {
                console.log(chalk_1.default.green(`   ✅ 成功路径 - 正常流程处理`));
            }
            else if (!isManual && systemCount > 1) {
                console.log(chalk_1.default.yellow(`   ⚠️ 异常路径 - 并发写入`));
            }
            else if (isManual) {
                console.log(chalk_1.default.magenta(`   🛠️ 人工修正路径 - 审计追踪`));
            }
            console.log();
        });
        if (summary) {
            console.log(chalk_1.default.bold('【材料摘要】'));
            console.log(summary.summary);
            console.log();
        }
        console.log(chalk_1.default.cyan('='.repeat(60)));
        console.log(chalk_1.default.cyan(`路径统计: ${conclusions.filter(c => !c.isManualCorrection).length}次系统处理, ${conclusions.filter(c => c.isManualCorrection).length}次人工修正`));
        console.log(chalk_1.default.cyan('='.repeat(60)));
        db.close();
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red(`错误: ${error.message}`));
        db.close();
        process.exit(2);
    }
});
function printProbeResult(result, index) {
    const prefix = index ? `${index}. ` : '';
    if (result.status === 'success') {
        console.log(chalk_1.default.green(`${prefix}✓ ${result.dependencyName} - 成功`));
        console.log(`   响应时间: ${result.responseTime}ms`);
    }
    else {
        console.log(chalk_1.default.red(`${prefix}✗ ${result.dependencyName} - 失败`));
        console.log(`   错误类型: ${chalk_1.default.yellow(result.errorType?.toUpperCase() || 'UNKNOWN')}`);
        console.log(`   错误信息: ${result.errorMessage}`);
        console.log(`   响应时间: ${result.responseTime}ms`);
    }
    console.log();
}
function formatStatus(status) {
    switch (status) {
        case 'approved':
            return chalk_1.default.green('已通过');
        case 'rejected':
            return chalk_1.default.red('已拒绝');
        case 'pending':
            return chalk_1.default.yellow('待审核');
        default:
            return status;
    }
}
function formatConclusion(conclusion) {
    switch (conclusion) {
        case 'pass':
            return chalk_1.default.green('通过');
        case 'fail':
            return chalk_1.default.red('拒绝');
        case 'review':
            return chalk_1.default.yellow('复核');
        default:
            return conclusion;
    }
}
program.parseAsync(process.argv);
