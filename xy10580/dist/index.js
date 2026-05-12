#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./utils/config");
const database_1 = require("./db/database");
const sampleData_1 = require("./data/sampleData");
const importService_1 = require("./services/importService");
const checkService_1 = require("./services/checkService");
const reportService_1 = require("./services/reportService");
const logger_1 = require("./utils/logger");
const program = new commander_1.Command();
program
    .name('appeal')
    .description('外卖骑手申诉 CLI 工具 - 处理超时、差评、取消单申诉')
    .version('1.0.0');
program
    .command('init')
    .description('初始化申诉系统数据库和目录结构')
    .option('--sample-data', '导入内置样例数据')
    .action(async (options) => {
    logger_1.logger.header('初始化申诉系统');
    const appealDir = (0, config_1.getAppealDir)();
    const dataDir = (0, config_1.getDataDir)();
    logger_1.logger.step(1, `工作目录: ${appealDir}`);
    logger_1.logger.step(2, '初始化数据库...');
    await (0, database_1.initDatabase)();
    logger_1.logger.success('数据库初始化完成');
    if (options.sampleData) {
        logger_1.logger.step(3, '导入内置样例数据...');
        const sample = (0, sampleData_1.getAllSampleData)();
        const orderResult = await (0, importService_1.importOrders)(sample.orders);
        logger_1.logger.info(`订单数据: ${orderResult.success}/${orderResult.total} 条导入成功`);
        const trajResult = await (0, importService_1.importTrajectories)(sample.trajectories);
        logger_1.logger.info(`轨迹数据: ${trajResult.success}/${trajResult.total} 条导入成功`);
        const mealResult = await (0, importService_1.importMerchantMeals)(sample.merchantMeals);
        logger_1.logger.info(`商家出餐数据: ${mealResult.success}/${mealResult.total} 条导入成功`);
        const weatherResult = await (0, importService_1.importWeatherEvents)(sample.weatherEvents);
        logger_1.logger.info(`天气数据: ${weatherResult.success}/${weatherResult.total} 条导入成功`);
        const penaltyResult = await (0, importService_1.importPenalties)(sample.penalties);
        logger_1.logger.info(`处罚数据: ${penaltyResult.success}/${penaltyResult.total} 条导入成功`);
        const appealResult = await (0, importService_1.importAppeals)(sample.appeals);
        logger_1.logger.info(`申诉数据: ${appealResult.success}/${appealResult.total} 条导入成功`);
        if (orderResult.failed > 0 || appealResult.failed > 0) {
            orderResult.failures.forEach(f => logger_1.logger.warn(`[订单导入失败] ${f.reason}`));
            appealResult.failures.forEach(f => logger_1.logger.warn(`[申诉导入失败] ${f.reason}`));
        }
        logger_1.logger.success('样例数据导入完成');
        logger_1.logger.divider();
        logger_1.logger.info('内置样例场景:');
        sample.scenarios.forEach((s, i) => {
            console.log(`  ${i + 1}. ${chalk_1.default.cyan(s.name)} - ${s.description}`);
        });
    }
    logger_1.logger.divider();
    logger_1.logger.success('系统初始化完成！');
    logger_1.logger.info(`数据目录: ${appealDir}`);
    logger_1.logger.info(`下一步: 使用 'appeal list' 查看申诉列表，或 'appeal check --all' 审核所有申诉`);
    (0, database_1.closeDb)();
});
program
    .command('import')
    .description('导入数据到申诉系统')
    .option('-t, --type <type>', '数据类型: orders|trajectories|meals|weather|penalties|appeals')
    .option('-f, --file <file>', 'JSON 文件路径')
    .option('--sample', '导入内置样例数据')
    .action(async (options) => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    logger_1.logger.header('导入数据');
    if (options.sample) {
        logger_1.logger.info('导入内置样例数据...');
        const sample = (0, sampleData_1.getAllSampleData)();
        const orderResult = await (0, importService_1.importOrders)(sample.orders);
        logger_1.logger.status('订单', `${orderResult.success}/${orderResult.total} 条`);
        const trajResult = await (0, importService_1.importTrajectories)(sample.trajectories);
        logger_1.logger.status('轨迹', `${trajResult.success}/${trajResult.total} 条`);
        const mealResult = await (0, importService_1.importMerchantMeals)(sample.merchantMeals);
        logger_1.logger.status('商家出餐', `${mealResult.success}/${mealResult.total} 条`);
        const weatherResult = await (0, importService_1.importWeatherEvents)(sample.weatherEvents);
        logger_1.logger.status('天气', `${weatherResult.success}/${weatherResult.total} 条`);
        const penaltyResult = await (0, importService_1.importPenalties)(sample.penalties);
        logger_1.logger.status('处罚', `${penaltyResult.success}/${penaltyResult.total} 条`);
        const appealResult = await (0, importService_1.importAppeals)(sample.appeals);
        logger_1.logger.status('申诉', `${appealResult.success}/${appealResult.total} 条`);
        if (appealResult.failures.length > 0) {
            logger_1.logger.warn('导入失败的申诉:');
            appealResult.failures.forEach(f => console.log(`  - ${f.reason}`));
        }
        logger_1.logger.success('样例数据导入完成');
        (0, database_1.closeDb)();
        return;
    }
    if (!options.type || !options.file) {
        logger_1.logger.error('请指定数据类型和文件路径');
        logger_1.logger.info('示例: appeal import -t orders -f ./data/orders.json');
        (0, database_1.closeDb)();
        process.exit(1);
    }
    const filePath = path_1.default.resolve(options.file);
    if (!fs_1.default.existsSync(filePath)) {
        logger_1.logger.error(`文件不存在: ${filePath}`);
        (0, database_1.closeDb)();
        process.exit(1);
    }
    try {
        const data = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
        const dataArray = Array.isArray(data) ? data : [data];
        let result;
        switch (options.type) {
            case 'orders':
                result = await (0, importService_1.importOrders)(dataArray);
                break;
            case 'trajectories':
                result = await (0, importService_1.importTrajectories)(dataArray);
                break;
            case 'meals':
                result = await (0, importService_1.importMerchantMeals)(dataArray);
                break;
            case 'weather':
                result = await (0, importService_1.importWeatherEvents)(dataArray);
                break;
            case 'penalties':
                result = await (0, importService_1.importPenalties)(dataArray);
                break;
            case 'appeals':
                result = await (0, importService_1.importAppeals)(dataArray);
                break;
            default:
                logger_1.logger.error(`未知数据类型: ${options.type}`);
                (0, database_1.closeDb)();
                process.exit(1);
        }
        logger_1.logger.success(`导入完成: ${result.success}/${result.total} 条成功`);
        if (result.failed > 0) {
            logger_1.logger.warn(`导入失败: ${result.failed} 条`);
            result.failures.forEach(f => {
                console.log(`  [${f.index}] ${f.reason}`);
            });
        }
    }
    catch (e) {
        logger_1.logger.error(`导入失败: ${e.message}`);
    }
    (0, database_1.closeDb)();
});
program
    .command('check')
    .description('审核申诉')
    .option('-a, --all', '审核所有待处理申诉')
    .option('-i, --id <id>', '审核指定申诉 ID')
    .option('--detail', '显示详细审核过程')
    .action(async (options) => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    logger_1.logger.header('申诉审核');
    const results = options.all ? await (0, checkService_1.checkPendingAppeals)() :
        options.id ? [await (0, checkService_1.checkAppeal)(options.id)] : [];
    if (results.length === 0) {
        logger_1.logger.info('没有待审核的申诉');
        (0, database_1.closeDb)();
        return;
    }
    results.forEach((result, idx) => {
        logger_1.logger.divider();
        logger_1.logger.step(idx + 1, `申诉 ${result.appealId}`);
        logger_1.logger.status('订单号', result.orderNo);
        logger_1.logger.status('类型', result.appealType);
        logger_1.logger.status('结果', result.status === 'approved' ? chalk_1.default.green('通过') : chalk_1.default.red('驳回'));
        logger_1.logger.status('判定', result.finalDecision);
        if (result.revertedAmount && result.revertedAmount > 0) {
            logger_1.logger.status('退回金额', chalk_1.default.green(`¥${result.revertedAmount.toFixed(2)}`));
        }
        if (options.detail && result.rules.length > 0) {
            console.log('');
            console.log(chalk_1.default.italic('  规则检查详情:'));
            result.rules.forEach(rule => {
                const status = rule.passed ? chalk_1.default.green('✓') : chalk_1.default.red('✗');
                console.log(`    ${status} ${rule.ruleId} ${rule.ruleName} (权重: ${rule.weight})`);
                console.log(`      ${rule.reason}`);
            });
            if (result.evidences.length > 0) {
                console.log('');
                console.log(chalk_1.default.italic('  证据清单:'));
                result.evidences.forEach(ev => {
                    console.log(`    [${ev.type.toUpperCase()}] ${ev.title}`);
                });
            }
        }
    });
    logger_1.logger.divider();
    logger_1.logger.success(`审核完成，共处理 ${results.length} 条申诉`);
    (0, database_1.closeDb)();
});
program
    .command('list')
    .description('列出申诉列表')
    .option('-s, --status <status>', '按状态过滤: pending|approved|rejected|corrected')
    .option('-t, --type <type>', '按类型过滤: timeout|bad_review|cancellation')
    .option('-r, --rider <id>', '按骑手 ID 过滤')
    .option('-o, --order <no>', '按订单号过滤')
    .action(async (options) => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    logger_1.logger.header('申诉列表');
    const appeals = await (0, reportService_1.listAppeals)({
        status: options.status,
        appealType: options.type,
        riderId: options.rider,
        orderNo: options.order
    });
    if (appeals.length === 0) {
        logger_1.logger.info('没有找到申诉记录');
        (0, database_1.closeDb)();
        return;
    }
    const table = new cli_table3_1.default({
        head: ['ID', '订单号', '类型', '状态', '提交时间', '退回金额'],
        colWidths: [24, 22, 14, 12, 20, 12]
    });
    appeals.forEach(a => {
        const statusColor = a.status === 'approved' ? chalk_1.default.green :
            a.status === 'rejected' ? chalk_1.default.red :
                a.status === 'corrected' ? chalk_1.default.yellow :
                    chalk_1.default.cyan;
        table.push([
            a.id,
            a.orderNo,
            a.appealType,
            statusColor(a.status),
            new Date(a.submitTime).toLocaleString().slice(0, 19),
            a.revertedAmount ? `¥${a.revertedAmount.toFixed(2)}` : '-'
        ]);
    });
    console.log(table.toString());
    const stats = await (0, reportService_1.getSummaryStats)();
    logger_1.logger.divider();
    logger_1.logger.status('统计', `共 ${stats.total} 条 | 待审核 ${stats.pending} | 通过 ${stats.approved} | 驳回 ${stats.rejected} | 修正 ${stats.corrected}`);
    logger_1.logger.status('金额', `总处罚 ¥${stats.totalPenaltyAmount.toFixed(2)} | 已退回 ¥${stats.totalRevertedAmount.toFixed(2)}`);
    (0, database_1.closeDb)();
});
program
    .command('detail')
    .description('查看申诉详情')
    .argument('<id>', '申诉 ID')
    .option('-e, --evidence', '显示详细证据')
    .option('-H, --history', '显示完整历史记录')
    .action(async (id, options) => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    try {
        const detail = await (0, reportService_1.getAppealDetail)(id);
        const { appeal, order, penalty, history, corrections } = detail;
        logger_1.logger.header('申诉详情');
        logger_1.logger.status('申诉 ID', appeal.id);
        logger_1.logger.status('订单号', appeal.orderNo);
        logger_1.logger.status('骑手', `${order?.riderName || appeal.riderId} (${appeal.riderId})`);
        logger_1.logger.status('申诉类型', appeal.appealType);
        logger_1.logger.status('申诉状态', appeal.status);
        logger_1.logger.status('提交时间', new Date(appeal.submitTime).toLocaleString());
        logger_1.logger.status('申诉原因', appeal.appealReason);
        if (appeal.checkTime) {
            logger_1.logger.status('审核时间', new Date(appeal.checkTime).toLocaleString());
        }
        if (appeal.checkResult) {
            logger_1.logger.divider();
            logger_1.logger.info(chalk_1.default.bold('审核结果:'));
            console.log(chalk_1.default.white(appeal.checkResult));
        }
        if (appeal.revertedAmount && appeal.revertedAmount > 0) {
            logger_1.logger.status('退回金额', chalk_1.default.green(`¥${appeal.revertedAmount.toFixed(2)}`));
        }
        if (order) {
            logger_1.logger.divider();
            logger_1.logger.info(chalk_1.default.bold('订单信息:'));
            logger_1.logger.status('  商家', order.merchantName);
            logger_1.logger.status('  用户', order.userName);
            logger_1.logger.status('  订单状态', order.status);
            if (order.status === 'cancelled') {
                logger_1.logger.status('  取消原因', order.cancelReason || '未知');
                logger_1.logger.status('  取消发起', order.cancelInitiator || '未知');
            }
        }
        if (penalty) {
            logger_1.logger.divider();
            logger_1.logger.info(chalk_1.default.bold('处罚信息:'));
            logger_1.logger.status('  类型', penalty.penaltyType);
            logger_1.logger.status('  金额', `¥${penalty.penaltyAmount.toFixed(2)}`);
            logger_1.logger.status('  原因', penalty.penaltyReason);
            logger_1.logger.status('  状态', penalty.status);
        }
        if (corrections.length > 0) {
            logger_1.logger.divider();
            logger_1.logger.info(chalk_1.default.bold('人工修正记录:'));
            corrections.forEach((corr, idx) => {
                console.log(`  [${idx + 1}] ${corr.operator} @ ${new Date(corr.createTime).toLocaleString()}`);
                console.log(`      状态: ${corr.beforeStatus} -> ${corr.afterStatus}`);
                console.log(`      金额: ¥${(corr.beforeRevertedAmount || 0).toFixed(2)} -> ¥${(corr.afterRevertedAmount || 0).toFixed(2)}`);
                console.log(`      原因: ${corr.reason}`);
            });
        }
        if (options.history) {
            logger_1.logger.divider();
            logger_1.logger.info(chalk_1.default.bold('完整历史记录:'));
            history.forEach((h, idx) => {
                const time = new Date(h.createTime).toLocaleString();
                const op = h.operator ? ` (${h.operator})` : '';
                const status = h.fromStatus && h.toStatus ? ` [${h.fromStatus}→${h.toStatus}]` : '';
                console.log(`  [${idx + 1}] ${time}${op} | ${h.action}${status}`);
                if (h.details) {
                    console.log(`      ${h.details}`);
                }
            });
        }
        if (options.evidence && appeal.checkEvidence) {
            try {
                const evidence = JSON.parse(appeal.checkEvidence);
                logger_1.logger.divider();
                logger_1.logger.info(chalk_1.default.bold('证据详情:'));
                evidence.forEach((ev) => {
                    console.log(`  [${ev.type.toUpperCase()}] ${ev.title}`);
                    ev.content.split('\n').forEach((line) => {
                        console.log(`    ${line}`);
                    });
                });
            }
            catch (e) {
                // 忽略解析错误
            }
        }
    }
    catch (e) {
        logger_1.logger.error(e.message);
    }
    (0, database_1.closeDb)();
});
program
    .command('report')
    .description('生成申诉报告')
    .argument('<id>', '申诉 ID')
    .option('-f, --format <format>', '输出格式: text|json (默认: text)')
    .option('-e, --export', '导出到文件')
    .action(async (id, options) => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    try {
        const format = (options.format || 'text');
        if (options.export) {
            const filePath = await (0, reportService_1.exportReportToFile)(id, format);
            logger_1.logger.success(`报告已导出: ${filePath}`);
        }
        else {
            const report = await (0, reportService_1.generateReport)(id, format);
            console.log(report);
        }
    }
    catch (e) {
        logger_1.logger.error(e.message);
    }
    (0, database_1.closeDb)();
});
program
    .command('correct')
    .description('人工修正申诉结果')
    .argument('<id>', '申诉 ID')
    .option('-s, --status <status>', '新状态: approved|rejected')
    .option('-a, --amount <amount>', '新的退回金额')
    .option('-r, --reason <reason>', '修正原因')
    .option('-o, --operator <name>', '操作员名称', 'admin')
    .action(async (id, options) => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    if (!options.status || !options.reason) {
        logger_1.logger.error('请指定新状态和修正原因');
        (0, database_1.closeDb)();
        process.exit(1);
    }
    try {
        const detail = await (0, reportService_1.getAppealDetail)(id);
        const newAmount = options.amount !== undefined ? parseFloat(options.amount) : detail.appeal.revertedAmount || 0;
        await (0, checkService_1.correctAppeal)(id, options.status, newAmount, options.reason, options.operator);
        logger_1.logger.success('修正完成');
        logger_1.logger.status('申诉 ID', id);
        logger_1.logger.status('操作员', options.operator);
        logger_1.logger.status('新状态', options.status);
        logger_1.logger.status('退回金额', `¥${newAmount.toFixed(2)}`);
        logger_1.logger.status('修正原因', options.reason);
    }
    catch (e) {
        logger_1.logger.error(e.message);
    }
    (0, database_1.closeDb)();
});
program
    .command('stats')
    .description('查看统计信息')
    .action(async () => {
    const initialized = await (0, database_1.isDatabaseInitialized)();
    if (!initialized) {
        logger_1.logger.error('数据库未初始化，请先运行 appeal init');
        process.exit(1);
    }
    logger_1.logger.header('申诉统计');
    const stats = await (0, reportService_1.getSummaryStats)();
    const table = new cli_table3_1.default({
        head: ['状态', '数量'],
        colWidths: [15, 10]
    });
    table.push(['待审核', stats.pending]);
    table.push(['已通过', chalk_1.default.green(stats.approved)]);
    table.push(['已驳回', chalk_1.default.red(stats.rejected)]);
    table.push(['已修正', chalk_1.default.yellow(stats.corrected)]);
    table.push(['总计', chalk_1.default.bold(stats.total)]);
    console.log(table.toString());
    logger_1.logger.divider();
    logger_1.logger.status('处罚总额', `¥${stats.totalPenaltyAmount.toFixed(2)}`);
    logger_1.logger.status('已退回', chalk_1.default.green(`¥${stats.totalRevertedAmount.toFixed(2)}`));
    logger_1.logger.status('退回率', stats.totalPenaltyAmount > 0
        ? `${((stats.totalRevertedAmount / stats.totalPenaltyAmount) * 100).toFixed(1)}%`
        : '0%');
    if (Object.keys(stats.byType).length > 0) {
        logger_1.logger.divider();
        logger_1.logger.info('按申诉类型统计:');
        Object.entries(stats.byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} 条`);
        });
    }
    (0, database_1.closeDb)();
});
program
    .command('demo')
    .description('运行完整演示流程')
    .action(async () => {
    logger_1.logger.header('申诉系统演示');
    logger_1.logger.step(1, '初始化数据库...');
    await (0, database_1.initDatabase)();
    logger_1.logger.success('数据库就绪');
    logger_1.logger.step(2, '导入样例数据...');
    const sample = (0, sampleData_1.getAllSampleData)();
    await (0, importService_1.importOrders)(sample.orders);
    await (0, importService_1.importTrajectories)(sample.trajectories);
    await (0, importService_1.importMerchantMeals)(sample.merchantMeals);
    await (0, importService_1.importWeatherEvents)(sample.weatherEvents);
    await (0, importService_1.importPenalties)(sample.penalties);
    const appealResult = await (0, importService_1.importAppeals)(sample.appeals);
    logger_1.logger.success(`导入了 ${appealResult.success} 条申诉`);
    logger_1.logger.step(3, '查看待审核申诉...');
    const pending = await (0, reportService_1.listAppeals)({ status: 'pending' });
    logger_1.logger.info(`待审核: ${pending.length} 条`);
    logger_1.logger.step(4, '自动审核所有申诉...');
    const results = await (0, checkService_1.checkPendingAppeals)();
    results.forEach((r, idx) => {
        const color = r.status === 'approved' ? chalk_1.default.green : chalk_1.default.red;
        console.log(`  ${idx + 1}. ${r.orderNo} (${r.appealType}) -> ${color(r.status)}`);
    });
    logger_1.logger.step(5, '查看统计...');
    const stats = await (0, reportService_1.getSummaryStats)();
    logger_1.logger.info(`通过: ${stats.approved}, 驳回: ${stats.rejected}, 退回金额: ¥${stats.totalRevertedAmount.toFixed(2)}`);
    logger_1.logger.divider();
    logger_1.logger.success('演示完成！');
    logger_1.logger.info('');
    logger_1.logger.info('可用命令:');
    logger_1.logger.info('  appeal list           查看申诉列表');
    logger_1.logger.info('  appeal detail <id>    查看申诉详情');
    logger_1.logger.info('  appeal report <id>    生成申诉报告');
    logger_1.logger.info('  appeal stats          查看统计信息');
    (0, database_1.closeDb)();
});
program.parseAsync(process.argv).catch(err => {
    console.error(err);
    process.exit(1);
});
if (process.argv.length <= 2) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map