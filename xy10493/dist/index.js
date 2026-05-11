#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const uuid_1 = require("uuid");
const data_store_1 = require("./data-store");
const importer_1 = require("./importer");
const difference_calculator_1 = require("./difference-calculator");
const review_adjustment_1 = require("./review-adjustment");
const report_generator_1 = require("./report-generator");
const program = new commander_1.Command();
program
    .name('inventory-audit')
    .description('仓库盘点差异复核 CLI 工具')
    .version('1.0.0');
program
    .command('init')
    .description('初始化新的盘点会话')
    .requiredOption('-n, --name <name>', '盘点名称')
    .action((options) => {
    const existing = data_store_1.dataStore.getAllAuditSessions();
    const duplicate = existing.find(s => s.name === options.name);
    if (duplicate) {
        console.log(chalk_1.default.red(`错误: 已存在同名盘点 "${options.name}"`));
        console.log(chalk_1.default.yellow(`盘点 ID: ${duplicate.id}`));
        process.exit(1);
    }
    const session = {
        id: (0, uuid_1.v4)(),
        name: options.name,
        status: 'importing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    data_store_1.dataStore.saveAuditSession(session);
    console.log(chalk_1.default.green('✓ 盘点会话已创建'));
    console.log(chalk_1.default.cyan(`盘点名称: ${session.name}`));
    console.log(chalk_1.default.cyan(`盘点 ID: ${session.id}`));
    console.log(chalk_1.default.gray('请使用此 ID 进行后续操作'));
});
program
    .command('list')
    .description('列出所有盘点会话')
    .action(() => {
    const sessions = data_store_1.dataStore.getAllAuditSessions();
    if (sessions.length === 0) {
        console.log(chalk_1.default.yellow('暂无盘点会话'));
        return;
    }
    console.log(chalk_1.default.cyan('='.repeat(80)));
    console.log(chalk_1.default.cyan('盘点会话列表'));
    console.log(chalk_1.default.cyan('='.repeat(80)));
    console.log(`${chalk_1.default.white('ID'.padEnd(38))} ${chalk_1.default.white('名称'.padEnd(25))} ` +
        `${chalk_1.default.white('状态'.padEnd(12))} ${chalk_1.default.white('创建时间'.padEnd(20))}`);
    console.log(chalk_1.default.cyan('-'.repeat(80)));
    const statusColors = {
        importing: chalk_1.default.yellow,
        calculated: chalk_1.default.blue,
        reviewing: chalk_1.default.magenta,
        adjusting: chalk_1.default.cyan,
        completed: chalk_1.default.green
    };
    const statusNames = {
        importing: '导入中',
        calculated: '已计算',
        reviewing: '复核中',
        adjusting: '调整中',
        completed: '已完成'
    };
    for (const session of sessions) {
        const statusColor = statusColors[session.status] || chalk_1.default.white;
        console.log(`${session.id.padEnd(38)} ${session.name.padEnd(25)} ` +
            `${statusColor(statusNames[session.status].padEnd(12))} ` +
            `${new Date(session.createdAt).toLocaleString('zh-CN').padEnd(20)}`);
    }
});
program
    .command('import-book')
    .description('导入账面库存')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .requiredOption('-f, --file <file>', 'CSV 文件路径')
    .action((options) => {
    const session = data_store_1.dataStore.getAuditSession(options.auditId);
    if (!session) {
        console.log(chalk_1.default.red(`错误: 盘点会话不存在: ${options.auditId}`));
        process.exit(1);
    }
    const existingDifferences = data_store_1.dataStore.getDifferences(options.auditId);
    if (existingDifferences.length > 0) {
        console.log(chalk_1.default.red('错误: 该盘点已完成差异计算，不能重复导入'));
        console.log(chalk_1.default.yellow('如需重新导入，请创建新的盘点会话'));
        process.exit(1);
    }
    try {
        const result = importer_1.dataImporter.importBookInventory(options.file, options.auditId);
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow(`导入完成，但有 ${result.errors.length} 个警告:`));
            for (const err of result.errors) {
                console.log(chalk_1.default.yellow(`  - ${err.message}`));
            }
        }
        console.log(chalk_1.default.green(`✓ 账面库存导入成功: ${result.importedCount} 条记录`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('import-count')
    .description('导入实盘结果')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .requiredOption('-f, --file <file>', 'CSV 文件路径')
    .action((options) => {
    const session = data_store_1.dataStore.getAuditSession(options.auditId);
    if (!session) {
        console.log(chalk_1.default.red(`错误: 盘点会话不存在: ${options.auditId}`));
        process.exit(1);
    }
    const existingDifferences = data_store_1.dataStore.getDifferences(options.auditId);
    if (existingDifferences.length > 0) {
        console.log(chalk_1.default.red('错误: 该盘点已完成差异计算，不能重复导入'));
        console.log(chalk_1.default.yellow('如需重新导入，请创建新的盘点会话'));
        process.exit(1);
    }
    try {
        const result = importer_1.dataImporter.importActualCount(options.file, options.auditId);
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow(`导入完成，但有 ${result.errors.length} 个警告:`));
            for (const err of result.errors) {
                console.log(chalk_1.default.yellow(`  - ${err.message}`));
            }
        }
        console.log(chalk_1.default.green(`✓ 实盘结果导入成功: ${result.importedCount} 条记录`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('import-owners')
    .description('导入库位负责人')
    .requiredOption('-f, --file <file>', 'CSV 文件路径')
    .action((options) => {
    try {
        const result = importer_1.dataImporter.importLocationOwners(options.file);
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow(`导入完成，但有 ${result.errors.length} 个警告:`));
            for (const err of result.errors) {
                console.log(chalk_1.default.yellow(`  - ${err.message}`));
            }
        }
        console.log(chalk_1.default.green(`✓ 库位负责人导入成功: ${result.importedCount} 条记录`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('calculate')
    .description('计算盘点差异')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .action((options) => {
    const session = data_store_1.dataStore.getAuditSession(options.auditId);
    if (!session) {
        console.log(chalk_1.default.red(`错误: 盘点会话不存在: ${options.auditId}`));
        process.exit(1);
    }
    const existingDifferences = data_store_1.dataStore.getDifferences(options.auditId);
    if (existingDifferences.length > 0) {
        console.log(chalk_1.default.red('错误: 该盘点已完成差异计算，不能重复计算'));
        console.log(chalk_1.default.yellow('如需重新计算，请创建新的盘点会话'));
        process.exit(1);
    }
    const bookInventory = data_store_1.dataStore.getBookInventory(options.auditId);
    const actualCount = data_store_1.dataStore.getActualCount(options.auditId);
    if (bookInventory.length === 0) {
        console.log(chalk_1.default.red('错误: 请先导入账面库存'));
        process.exit(1);
    }
    if (actualCount.length === 0) {
        console.log(chalk_1.default.yellow('警告: 尚未导入实盘结果，将全部视为未盘'));
    }
    const result = difference_calculator_1.differenceCalculator.calculateDifferences(options.auditId);
    if (!result.success) {
        for (const err of result.errors) {
            console.log(chalk_1.default.red(`错误: ${err.message}`));
        }
        process.exit(1);
    }
    console.log(chalk_1.default.green('✓ 差异计算完成'));
    console.log(chalk_1.default.cyan('='.repeat(50)));
    console.log(`总记录数: ${result.totalItems}`);
    console.log(`一致: ${result.matchedItems}`);
    console.log(`盘盈: ${result.profitItems}`);
    console.log(`盘亏: ${result.lossItems}`);
    console.log(`未盘: ${result.notCountedItems}`);
    console.log(`多盘: ${result.overCountedItems}`);
    console.log(chalk_1.default.cyan('='.repeat(50)));
});
program
    .command('view')
    .description('查看库位差异')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .option('-l, --location <location>', '按库位筛选')
    .option('-o, --owner <owner>', '按负责人筛选')
    .option('-t, --type <type>', '按差异类型筛选 (profit/loss/not_counted/over_counted/matched)')
    .option('-u, --unmatched', '仅显示不一致的记录')
    .action((options) => {
    const session = data_store_1.dataStore.getAuditSession(options.auditId);
    if (!session) {
        console.log(chalk_1.default.red(`错误: 盘点会话不存在: ${options.auditId}`));
        process.exit(1);
    }
    let differences = data_store_1.dataStore.getDifferences(options.auditId);
    if (differences.length === 0) {
        console.log(chalk_1.default.yellow('该盘点尚未计算差异，请先运行 calculate 命令'));
        return;
    }
    if (options.location) {
        differences = differences.filter(d => d.location === options.location);
    }
    if (options.owner) {
        differences = differences.filter(d => d.owner === options.owner);
    }
    if (options.type) {
        differences = differences.filter(d => d.differenceType === options.type);
    }
    if (options.unmatched) {
        differences = differences.filter(d => d.differenceType !== 'matched');
    }
    if (differences.length === 0) {
        console.log(chalk_1.default.yellow('没有找到符合条件的差异记录'));
        return;
    }
    const typeColors = {
        matched: chalk_1.default.green,
        profit: chalk_1.default.cyan,
        loss: chalk_1.default.red,
        not_counted: chalk_1.default.magenta,
        over_counted: chalk_1.default.yellow
    };
    const typeNames = {
        matched: '一致',
        profit: '盘盈',
        loss: '盘亏',
        not_counted: '未盘',
        over_counted: '多盘'
    };
    const statusNames = {
        pending: '待审批',
        approved: '已通过',
        rejected: '已驳回'
    };
    console.log(chalk_1.default.cyan('='.repeat(120)));
    console.log(chalk_1.default.cyan(`差异记录 (共 ${differences.length} 条)`));
    console.log(chalk_1.default.cyan('='.repeat(120)));
    console.log(`${chalk_1.default.white('库位'.padEnd(10))} ${chalk_1.default.white('SKU'.padEnd(15))} ` +
        `${chalk_1.default.white('账面'.padEnd(8))} ${chalk_1.default.white('实盘'.padEnd(8))} ` +
        `${chalk_1.default.white('差异'.padEnd(8))} ${chalk_1.default.white('类型'.padEnd(8))} ` +
        `${chalk_1.default.white('负责人'.padEnd(10))} ${chalk_1.default.white('状态'.padEnd(8))} ` +
        `${chalk_1.default.white('差异ID'.padEnd(36))}`);
    console.log(chalk_1.default.cyan('-'.repeat(120)));
    for (const d of differences) {
        const typeColor = typeColors[d.differenceType];
        console.log(`${d.location.padEnd(10)} ${d.sku.padEnd(15)} ` +
            `${String(d.bookQuantity).padEnd(8)} ${String(d.actualQuantity).padEnd(8)} ` +
            `${String(d.differenceQuantity).padEnd(8)} ` +
            `${typeColor(typeNames[d.differenceType].padEnd(8))} ` +
            `${d.owner.padEnd(10)} ${statusNames[d.approvalStatus].padEnd(8)} ` +
            `${d.id.padEnd(36)}`);
    }
});
program
    .command('review')
    .description('登记复核原因')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
    .requiredOption('-r, --reason <reason>', '复核原因')
    .requiredOption('-b, --reviewed-by <reviewedBy>', '复核人')
    .action((options) => {
    const result = review_adjustment_1.reviewAndAdjustmentService.registerReviewReason(options.auditId, options.differenceId, options.reason, options.reviewedBy);
    if (result.success) {
        console.log(chalk_1.default.green(`✓ ${result.message}`));
    }
    else {
        for (const err of result.errors) {
            console.log(chalk_1.default.red(`错误: ${err.message}`));
        }
        process.exit(1);
    }
});
program
    .command('submit-adjustment')
    .description('提交调整')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
    .requiredOption('-q, --quantity <quantity>', '调整数量 (正数为增加，负数为减少)')
    .requiredOption('-b, --submitted-by <submittedBy>', '提交人')
    .action((options) => {
    const adjustmentQty = parseInt(options.quantity, 10);
    if (isNaN(adjustmentQty)) {
        console.log(chalk_1.default.red('错误: 调整数量必须是有效数字'));
        process.exit(1);
    }
    const result = review_adjustment_1.reviewAndAdjustmentService.submitAdjustment(options.auditId, options.differenceId, adjustmentQty, options.submittedBy);
    if (result.success) {
        console.log(chalk_1.default.green(`✓ ${result.message}`));
    }
    else {
        for (const err of result.errors) {
            if (err.type === 'adjustment_exceeds_difference') {
                console.log(chalk_1.default.red(`错误: ${err.message}`));
                console.log(chalk_1.default.yellow(`  差异数量: ${err.details.differenceQuantity}`));
                console.log(chalk_1.default.yellow(`  调整数量: ${err.details.adjustmentQuantity}`));
            }
            else {
                console.log(chalk_1.default.red(`错误: ${err.message}`));
            }
        }
        process.exit(1);
    }
});
program
    .command('approve')
    .description('审批通过调整')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
    .requiredOption('-b, --approved-by <approvedBy>', '审批人')
    .action((options) => {
    const result = review_adjustment_1.reviewAndAdjustmentService.approveAdjustment(options.auditId, options.differenceId, options.approvedBy);
    if (result.success) {
        console.log(chalk_1.default.green(`✓ ${result.message}`));
    }
    else {
        for (const err of result.errors) {
            console.log(chalk_1.default.red(`错误: ${err.message}`));
        }
        process.exit(1);
    }
});
program
    .command('reject')
    .description('审批驳回调整')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .requiredOption('-d, --difference-id <differenceId>', '差异 ID')
    .requiredOption('-r, --reason <reason>', '驳回原因')
    .requiredOption('-b, --rejected-by <rejectedBy>', '驳回人')
    .action((options) => {
    const result = review_adjustment_1.reviewAndAdjustmentService.rejectAdjustment(options.auditId, options.differenceId, options.rejectedBy, options.reason);
    if (result.success) {
        console.log(chalk_1.default.green(`✓ ${result.message}`));
    }
    else {
        for (const err of result.errors) {
            console.log(chalk_1.default.red(`错误: ${err.message}`));
        }
        process.exit(1);
    }
});
program
    .command('pending')
    .description('查看待审批记录')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .action((options) => {
    const pending = review_adjustment_1.reviewAndAdjustmentService.getPendingApproval(options.auditId);
    if (pending.length === 0) {
        console.log(chalk_1.default.green('没有待审批的记录'));
        return;
    }
    console.log(chalk_1.default.yellow(`待审批记录 (共 ${pending.length} 条)`));
    console.log(chalk_1.default.cyan('='.repeat(100)));
    console.log(`${chalk_1.default.white('差异ID'.padEnd(36))} ${chalk_1.default.white('库位'.padEnd(10))} ` +
        `${chalk_1.default.white('SKU'.padEnd(15))} ${chalk_1.default.white('差异'.padEnd(8))} ` +
        `${chalk_1.default.white('调整'.padEnd(8))} ${chalk_1.default.white('提交人'.padEnd(10))}`);
    console.log(chalk_1.default.cyan('-'.repeat(100)));
    for (const d of pending) {
        console.log(`${d.id.padEnd(36)} ${d.location.padEnd(10)} ` +
            `${d.sku.padEnd(15)} ${String(d.differenceQuantity).padEnd(8)} ` +
            `${String(d.adjustmentQuantity || 0).padEnd(8)} ` +
            `${(d.reviewedBy || '-').padEnd(10)}`);
    }
});
program
    .command('history')
    .description('查看调整历史')
    .option('-a, --audit-id <auditId>', '按盘点 ID 筛选')
    .action((options) => {
    const history = review_adjustment_1.reviewAndAdjustmentService.getAdjustmentHistory(options.auditId);
    if (history.length === 0) {
        console.log(chalk_1.default.yellow('暂无调整历史记录'));
        return;
    }
    console.log(chalk_1.default.cyan('='.repeat(100)));
    console.log(chalk_1.default.cyan('调整历史记录'));
    console.log(chalk_1.default.cyan('='.repeat(100)));
    console.log(`${chalk_1.default.white('时间'.padEnd(20))} ${chalk_1.default.white('库位'.padEnd(10))} ` +
        `${chalk_1.default.white('SKU'.padEnd(15))} ${chalk_1.default.white('调整前'.padEnd(8))} ` +
        `${chalk_1.default.white('调整后'.padEnd(8))} ${chalk_1.default.white('调整量'.padEnd(8))} ` +
        `${chalk_1.default.white('审批人'.padEnd(10))}`);
    console.log(chalk_1.default.cyan('-'.repeat(100)));
    for (const h of history) {
        console.log(`${new Date(h.approvedAt).toLocaleString('zh-CN').padEnd(20)} ` +
            `${h.location.padEnd(10)} ${h.sku.padEnd(15)} ` +
            `${String(h.oldQuantity).padEnd(8)} ${String(h.newQuantity).padEnd(8)} ` +
            `${String(h.adjustmentQuantity).padEnd(8)} ${h.approvedBy.padEnd(10)}`);
    }
});
program
    .command('report')
    .description('生成盘点报告')
    .requiredOption('-a, --audit-id <auditId>', '盘点 ID')
    .action((options) => {
    const session = data_store_1.dataStore.getAuditSession(options.auditId);
    if (!session) {
        console.log(chalk_1.default.red(`错误: 盘点会话不存在: ${options.auditId}`));
        process.exit(1);
    }
    try {
        const report = report_generator_1.reportGenerator.generateReport(options.auditId);
        const display = report_generator_1.reportGenerator.formatReportForDisplay(report);
        console.log(display);
        console.log('');
        console.log(chalk_1.default.green(`✓ 报告已生成并保存`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`错误: ${error.message}`));
        process.exit(1);
    }
});
program.parse(process.argv);
