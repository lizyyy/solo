#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = require("fs");
const path_1 = require("path");
const database_1 = require("./database");
const processor_1 = require("./processor");
const types_1 = require("./types");
const program = new commander_1.Command();
program
    .name('backlog')
    .description('消息积压分层命令行工具')
    .version('1.0.0');
async function init() {
    const dataDir = (0, path_1.join)(process.cwd(), 'data');
    if (!(0, fs_1.existsSync)(dataDir)) {
        (0, fs_1.mkdirSync)(dataDir, { recursive: true });
    }
    await database_1.db.init();
}
program
    .command('ticket:create')
    .description('创建临时权限票')
    .requiredOption('-n, --ticket-no <no>', '票号')
    .requiredOption('-a, --applicant <name>', '申请人')
    .requiredOption('-d, --department <dept>', '部门')
    .requiredOption('-p, --permission <type>', '权限类型')
    .requiredOption('-r, --reason <reason>', '申请原因')
    .requiredOption('-s, --start-time <time>', '开始时间 (ISO格式)')
    .requiredOption('-e, --end-time <time>', '结束时间 (ISO格式)')
    .requiredOption('-c, --created-by <name>', '创建人')
    .action(async (options) => {
    await init();
    try {
        const ticket = await processor_1.processor.createTempTicket({
            ticketNo: options.ticketNo,
            applicant: options.applicant,
            department: options.department,
            permissionType: options.permission,
            reason: options.reason,
            startTime: new Date(options.startTime),
            endTime: new Date(options.endTime),
            createdBy: options.createdBy
        });
        console.log(chalk_1.default.green('✓ 临时票创建成功'));
        console.log(`  ID: ${ticket.id}`);
        console.log(`  票号: ${ticket.ticketNo}`);
        console.log(`  申请人: ${ticket.applicant}`);
        console.log(`  部门: ${ticket.department}`);
        console.log(`  权限: ${ticket.permissionType}`);
        console.log(`  有效期: ${ticket.startTime.toLocaleString()} ~ ${ticket.endTime.toLocaleString()}`);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 创建失败:'), error.message);
    }
});
program
    .command('batch:import')
    .description('导入批次数据')
    .requiredOption('-f, --file <path>', 'JSON数据文件路径')
    .requiredOption('-n, --batch-no <no>', '批次号')
    .requiredOption('-m, --name <name>', '批次名称')
    .requiredOption('-o, --operator <name>', '操作人')
    .requiredOption('-t, --ticket-id <id>', '关联临时票ID')
    .action(async (options) => {
    await init();
    try {
        const data = JSON.parse((0, fs_1.readFileSync)(options.file, 'utf-8'));
        const batch = await processor_1.processor.createBatch({
            batchNo: options.batchNo,
            name: options.name,
            operator: options.operator,
            ticketId: options.ticketId,
            records: data
        });
        console.log(chalk_1.default.green('✓ 批次导入成功'));
        console.log(`  批次ID: ${batch.id}`);
        console.log(`  批次号: ${batch.batchNo}`);
        console.log(`  批次名称: ${batch.name}`);
        console.log(`  记录总数: ${batch.totalCount}`);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 导入失败:'), error.message);
    }
});
program
    .command('batch:preview')
    .description('预览批次处理结果')
    .requiredOption('-i, --batch-id <id>', '批次ID')
    .action(async (options) => {
    await init();
    try {
        const result = await processor_1.processor.previewBatch(options.batchId);
        console.log(chalk_1.default.blue('=== 批次处理预览 ==='));
        console.log(`批次ID: ${result.batchId}`);
        console.log(`总计: ${result.total} 条`);
        console.log(chalk_1.default.green(`预计成功: ${result.success} 条`));
        console.log(chalk_1.default.yellow(`预计拦截: ${result.blocked} 条`));
        console.log();
        const table = new cli_table3_1.default({
            head: ['用户姓名', '手机号', '预计状态', '原因'],
            colWidths: [15, 15, 25, 50]
        });
        result.results.forEach(r => {
            const status = r.status === types_1.ProcessingStatus.SUCCESS
                ? chalk_1.default.green(r.status)
                : chalk_1.default.yellow(r.status);
            table.push([r.userName, r.phone, status, r.reason || '']);
        });
        console.log(table.toString());
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 预览失败:'), error.message);
    }
});
program
    .command('batch:process')
    .description('执行批次处理')
    .requiredOption('-i, --batch-id <id>', '批次ID')
    .option('-y, --yes', '跳过确认直接执行')
    .action(async (options) => {
    await init();
    try {
        const preview = await processor_1.processor.previewBatch(options.batchId);
        console.log(chalk_1.default.blue('=== 批次处理确认 ==='));
        console.log(`批次ID: ${preview.batchId}`);
        console.log(`总计: ${preview.total} 条`);
        console.log(chalk_1.default.green(`预计成功: ${preview.success} 条`));
        console.log(chalk_1.default.yellow(`预计拦截: ${preview.blocked} 条`));
        console.log();
        if (preview.blocked > 0) {
            console.log(chalk_1.default.yellow('⚠ 注意: 以下记录将被拦截:'));
            const blocked = preview.results.filter(r => r.status === types_1.ProcessingStatus.BLOCKED);
            blocked.forEach(r => {
                console.log(`  - ${r.userName} (${r.phone}): ${r.reason}`);
            });
            console.log();
        }
        if (!options.yes) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: '确认执行批次处理?',
                    default: false
                }
            ]);
            if (!answers.confirm) {
                console.log(chalk_1.default.gray('已取消处理'));
                return;
            }
        }
        const result = await processor_1.processor.processBatch(options.batchId);
        console.log();
        console.log(chalk_1.default.green('✓ 批次处理完成'));
        console.log(`批次ID: ${result.batchId}`);
        console.log(`总计: ${result.total} 条`);
        console.log(chalk_1.default.green(`成功: ${result.success} 条`));
        console.log(chalk_1.default.yellow(`拦截: ${result.blocked} 条`));
        console.log();
        if (result.blocked > 0) {
            console.log(chalk_1.default.yellow('=== 拦截详情 ==='));
            const blockedRecords = result.results.filter(r => r.status === types_1.ProcessingStatus.EARLY_TERMINATION_BLOCKED);
            const table = new cli_table3_1.default({
                head: ['用户姓名', '手机号', '拦截原因'],
                colWidths: [15, 15, 70]
            });
            blockedRecords.forEach(r => {
                table.push([r.userName, r.phone, r.reason || '']);
            });
            console.log(table.toString());
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 处理失败:'), error.message);
    }
});
program
    .command('record:query')
    .description('查询记录')
    .option('-b, --batch-id <id>', '按批次ID过滤')
    .option('-o, --operator <name>', '按操作人过滤')
    .option('-r, --risk-type <type>', '按风险类型过滤 (HIGH/MEDIUM/LOW)')
    .option('-s, --status <status>', '按状态过滤')
    .action(async (options) => {
    await init();
    try {
        const filters = {};
        if (options.batchId)
            filters.batchId = options.batchId;
        if (options.operator)
            filters.operator = options.operator;
        if (options.riskType)
            filters.riskType = options.riskType;
        if (options.status)
            filters.status = options.status;
        const records = await processor_1.processor.queryRecords(Object.keys(filters).length > 0 ? filters : undefined);
        console.log(chalk_1.default.blue(`=== 查询结果 (${records.length} 条) ===`));
        console.log();
        const table = new cli_table3_1.default({
            head: ['用户姓名', '手机号', '风险类型', '风险分', '状态', '操作人'],
            colWidths: [15, 15, 12, 10, 25, 15]
        });
        records.forEach(r => {
            let riskColor = chalk_1.default.green;
            if (r.riskType === types_1.RiskType.HIGH)
                riskColor = chalk_1.default.red;
            else if (r.riskType === types_1.RiskType.MEDIUM)
                riskColor = chalk_1.default.yellow;
            let statusColor = chalk_1.default.green;
            if (r.status === types_1.ProcessingStatus.EARLY_TERMINATION_BLOCKED || r.status === types_1.ProcessingStatus.BLOCKED) {
                statusColor = chalk_1.default.yellow;
            }
            else if (r.status === types_1.ProcessingStatus.FAILED) {
                statusColor = chalk_1.default.red;
            }
            table.push([
                r.userName,
                r.phone,
                riskColor(r.riskType),
                r.riskScore.toString(),
                statusColor(r.status),
                r.operator
            ]);
        });
        console.log(table.toString());
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 查询失败:'), error.message);
    }
});
program
    .command('record:detail')
    .description('查看记录详情')
    .requiredOption('-i, --record-id <id>', '记录ID')
    .action(async (options) => {
    await init();
    try {
        const detail = await processor_1.processor.getRecordDetail(options.recordId);
        if (!detail) {
            console.error(chalk_1.default.red('✗ 记录不存在'));
            return;
        }
        const { record, reviews } = detail;
        console.log(chalk_1.default.blue('=== 记录详情 ==='));
        console.log(`记录ID: ${record.id}`);
        console.log(`批次ID: ${record.batchId}`);
        console.log(`用户姓名: ${record.userName}`);
        console.log(`手机号: ${record.phone}`);
        console.log(`身份证号: ${record.idCard}`);
        console.log(`消息内容: ${record.content}`);
        console.log(`风险类型: ${record.riskType}`);
        console.log(`风险评分: ${record.riskScore}`);
        console.log(`风险原因: ${record.riskReason}`);
        console.log(`当前状态: ${record.status}`);
        if (record.blockReason) {
            console.log(chalk_1.default.yellow(`拦截原因: ${record.blockReason}`));
        }
        console.log(`操作人: ${record.operator}`);
        console.log(`创建时间: ${record.createdAt.toLocaleString()}`);
        console.log();
        if (reviews.length > 0) {
            console.log(chalk_1.default.magenta('=== 复核记录 ==='));
            reviews.forEach((review, index) => {
                console.log(chalk_1.default.gray(`--- 复核 ${index + 1} ---`));
                console.log(`复核人: ${review.reviewer}`);
                console.log(`复核意见: ${review.reviewOpinion}`);
                console.log(`客服工单: ${review.serviceTicketNo}`);
                console.log(`原结论: ${review.originalConclusion}`);
                console.log(`新结论: ${review.newConclusion}`);
                console.log(`复核时间: ${review.reviewedAt.toLocaleString()}`);
                console.log();
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 查询失败:'), error.message);
    }
});
program
    .command('record:review')
    .description('复核记录')
    .requiredOption('-i, --record-id <id>', '记录ID')
    .requiredOption('-r, --reviewer <name>', '复核人')
    .requiredOption('-o, --opinion <text>', '复核意见')
    .requiredOption('-t, --ticket-no <no>', '客服工单号')
    .requiredOption('-c, --conclusion <status>', '新结论')
    .action(async (options) => {
    await init();
    try {
        const review = await processor_1.processor.reviewMessage({
            messageId: options.recordId,
            reviewer: options.reviewer,
            reviewOpinion: options.opinion,
            serviceTicketNo: options.ticketNo,
            newConclusion: options.conclusion
        });
        console.log(chalk_1.default.green('✓ 复核成功'));
        console.log(`复核ID: ${review.id}`);
        console.log(`复核人: ${review.reviewer}`);
        console.log(`复核意见: ${review.reviewOpinion}`);
        console.log(`关联客服工单: ${review.serviceTicketNo}`);
        console.log(`原结论: ${review.originalConclusion}`);
        console.log(`新结论: ${review.newConclusion}`);
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 复核失败:'), error.message);
    }
});
program
    .command('batch:list')
    .description('列出所有批次')
    .action(async () => {
    await init();
    try {
        const batches = await processor_1.processor.queryBatches();
        console.log(chalk_1.default.blue(`=== 批次列表 (${batches.length} 条) ===`));
        console.log();
        const table = new cli_table3_1.default({
            head: ['批次号', '名称', '操作人', '总数', '成功', '拦截', '状态', '创建时间'],
            colWidths: [15, 20, 12, 8, 8, 8, 20, 22]
        });
        batches.forEach(b => {
            let statusColor = chalk_1.default.green;
            if (b.status === types_1.ProcessingStatus.PARTIAL_SUCCESS)
                statusColor = chalk_1.default.yellow;
            else if (b.status === types_1.ProcessingStatus.BLOCKED)
                statusColor = chalk_1.default.yellow;
            else if (b.status === types_1.ProcessingStatus.PENDING)
                statusColor = chalk_1.default.gray;
            table.push([
                b.batchNo,
                b.name,
                b.operator,
                b.totalCount.toString(),
                b.successCount.toString(),
                b.blockedCount.toString(),
                statusColor(b.status),
                b.createdAt.toLocaleString().substring(0, 19)
            ]);
        });
        console.log(table.toString());
    }
    catch (error) {
        console.error(chalk_1.default.red('✗ 查询失败:'), error.message);
    }
});
program.parseAsync(process.argv);
