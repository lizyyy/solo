"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCLI = runCLI;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const database_1 = require("./database");
const importer_1 = require("./importer");
const checker_1 = require("./checker");
const correction_1 = require("./correction");
const sample_data_1 = require("./sample-data");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const program = new commander_1.Command();
function formatStatus(status) {
    switch (status) {
        case 'PASS':
            return chalk_1.default.green('✓ PASS');
        case 'MUST_REPRINT':
            return chalk_1.default.red('✗ MUST_REPRINT');
        case 'CAN_CONTINUE':
            return chalk_1.default.yellow('⚠ CAN_CONTINUE');
        case 'NEEDS_MANUAL_CHECK':
            return chalk_1.default.magenta('? NEEDS_MANUAL_CHECK');
        case 'MANUALLY_APPROVED':
            return chalk_1.default.blue('✓ MANUALLY_APPROVED');
        case 'MANUALLY_REJECTED':
            return chalk_1.default.red('✗ MANUALLY_REJECTED');
        default:
            return status;
    }
}
function formatSeverity(severity) {
    switch (severity) {
        case 'CRITICAL':
            return chalk_1.default.red('CRITICAL');
        case 'WARNING':
            return chalk_1.default.yellow('WARNING');
        case 'INFO':
            return chalk_1.default.blue('INFO');
        default:
            return severity;
    }
}
function printImportStats(stats) {
    const table = new cli_table3_1.default({
        head: ['类型', '新增', '更新', '跳过(幂等)'],
        colWidths: [20, 10, 10, 15]
    });
    table.push(['门店', stats.stores.inserted, stats.stores.updated, stats.stores.skipped]);
    table.push(['商品', stats.products.inserted, stats.products.updated, stats.products.skipped]);
    table.push(['门店价', stats.storePrices.inserted, stats.storePrices.updated, stats.storePrices.skipped]);
    table.push(['促销活动', stats.promotions.inserted, stats.promotions.updated, stats.promotions.skipped]);
    table.push(['打印记录', stats.tagPrintRecords.inserted, stats.tagPrintRecords.updated, stats.tagPrintRecords.skipped]);
    table.push(['扫描记录', stats.tagScans.inserted, stats.tagScans.updated, stats.tagScans.skipped]);
    console.log(table.toString());
}
program
    .name('price-tag-checker')
    .description('促销价签校对 CLI 工具')
    .version('1.0.0');
program
    .command('init')
    .description('初始化数据库和工作目录')
    .action(() => {
    try {
        console.log(chalk_1.default.blue('正在初始化...'));
        (0, database_1.initDatabase)();
        console.log(chalk_1.default.green('✓ 初始化成功！'));
        console.log(chalk_1.default.gray(`  数据目录: ${(0, database_1.getDataDir)()}`));
        console.log(chalk_1.default.gray(`  数据库: ${(0, database_1.getDbPath)()}`));
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 初始化失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('seed')
    .description('导入内置样例数据（生鲜、日化、家电）')
    .action(() => {
    try {
        const sampleData = (0, sample_data_1.createSampleData)();
        const stats = (0, importer_1.importData)(sampleData);
        console.log(chalk_1.default.green('✓ 样例数据导入成功！'));
        console.log(chalk_1.default.gray('  包含数据：生鲜(FRESH)、日化(DAILY)、家电(ELEC)'));
        console.log('');
        printImportStats(stats);
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 导入失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('import')
    .description('从 JSON 文件导入数据')
    .argument('<file>', 'JSON 数据文件路径')
    .action((filePath) => {
    try {
        const absPath = path_1.default.resolve(filePath);
        if (!fs_1.default.existsSync(absPath)) {
            console.error(chalk_1.default.red(`✗ 文件不存在: ${absPath}`));
            process.exit(1);
        }
        const rawData = fs_1.default.readFileSync(absPath, 'utf-8');
        const data = JSON.parse(rawData);
        console.log(chalk_1.default.blue(`正在导入: ${absPath}`));
        const stats = (0, importer_1.importData)(data);
        console.log(chalk_1.default.green('✓ 导入成功！'));
        console.log('');
        printImportStats(stats);
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 导入失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('check')
    .description('执行价签校对')
    .option('-s, --store <storeId>', '门店ID过滤')
    .option('-k, --sku <sku>', 'SKU过滤')
    .option('-t, --time <time>', '校对时间 (格式: YYYY-MM-DD HH:MM:SS)')
    .action((options) => {
    try {
        const checkOptions = {
            storeId: options.store,
            sku: options.sku,
            checkTime: options.time
        };
        console.log(chalk_1.default.blue('正在执行价签校对...'));
        const { results, summary, checkTime } = (0, checker_1.runCheck)(checkOptions);
        console.log(chalk_1.default.green(`✓ 校对完成！ 时间: ${checkTime}`));
        console.log('');
        const table = new cli_table3_1.default({
            head: ['状态', '数量', '说明'],
            colWidths: [25, 10, 40]
        });
        table.push([formatStatus('PASS'), summary.pass, '完全通过，价签正常'], [formatStatus('MUST_REPRINT'), summary.mustReprint, '必须重打，价格/版本严重不一致'], [formatStatus('CAN_CONTINUE'), summary.canContinue, '可继续使用，轻微差异'], [formatStatus('NEEDS_MANUAL_CHECK'), summary.needsManualCheck, '需人工确认'], [formatStatus('MANUALLY_APPROVED'), summary.manuallyApproved, '人工通过'], [formatStatus('MANUALLY_REJECTED'), summary.manuallyRejected, '人工拒绝']);
        console.log(table.toString());
        console.log('');
        console.log(chalk_1.default.blue(`总计: ${summary.total} 条`));
        if (summary.mustReprint > 0) {
            console.log(chalk_1.default.yellow(`\n⚠ 有 ${summary.mustReprint} 张价签必须重打，请使用 detail 命令查看详情`));
        }
        if (summary.needsManualCheck > 0) {
            console.log(chalk_1.default.magenta(`\n? 有 ${summary.needsManualCheck} 张价签需要人工确认，请使用 correct 命令处理`));
        }
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 校对失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('list')
    .description('列出所有校对结果')
    .option('-s, --store <storeId>', '门店ID过滤')
    .option('-k, --sku <sku>', 'SKU过滤')
    .option('--status <status>', '状态过滤 (PASS|MUST_REPRINT|CAN_CONTINUE|NEEDS_MANUAL_CHECK)')
    .action((options) => {
    try {
        const checkOptions = {
            storeId: options.store,
            sku: options.sku
        };
        let results = (0, checker_1.getAllCheckResults)(checkOptions);
        if (options.status) {
            results = results.filter(r => r.status === options.status);
        }
        const table = new cli_table3_1.default({
            head: ['结果ID', '门店', 'SKU', '状态', '系统价', '扫描价', '校对时间'],
            colWidths: [38, 15, 15, 22, 12, 12, 22]
        });
        for (const r of results) {
            table.push([
                r.id,
                r.store_id,
                r.sku,
                formatStatus(r.status),
                `¥${r.system_price.toFixed(2)}`,
                `¥${r.scanned_price.toFixed(2)}`,
                r.check_time
            ]);
        }
        console.log(table.toString());
        console.log(chalk_1.default.blue(`\n共 ${results.length} 条记录`));
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 查询失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('detail')
    .description('查看单个校对结果的详细信息')
    .argument('<resultId>', '校对结果ID')
    .action((resultId) => {
    try {
        const result = (0, checker_1.getCheckResultById)(resultId);
        if (!result) {
            console.error(chalk_1.default.red(`✗ 结果不存在: ${resultId}`));
            process.exit(1);
        }
        const issues = (0, checker_1.getCheckIssues)(resultId);
        const history = (0, checker_1.getStatusHistory)(resultId);
        const corrections = (0, correction_1.getManualCorrections)(resultId);
        console.log(chalk_1.default.blue('══════════════════════════════════════════════════'));
        console.log(chalk_1.default.blue('  价签校对详情'));
        console.log(chalk_1.default.blue('══════════════════════════════════════════════════'));
        console.log('');
        console.log(chalk_1.default.bold('基本信息'));
        const infoTable = new cli_table3_1.default({
            colWidths: [20, 60],
            style: { 'padding-left': 2, 'padding-right': 2 }
        });
        infoTable.push(['结果ID', result.id], ['门店', result.store_id], ['SKU', result.sku], ['状态', formatStatus(result.status)], ['校对时间', result.check_time]);
        console.log(infoTable.toString());
        console.log('');
        console.log(chalk_1.default.bold('价格对比'));
        const priceTable = new cli_table3_1.default({
            head: ['价格类型', '金额', '说明'],
            colWidths: [15, 15, 45]
        });
        const systemPrice = result.system_price ?? 0;
        const scannedPrice = result.scanned_price ?? 0;
        priceTable.push(['系统价', `¥${systemPrice.toFixed(2)}`, '当前生效的系统价格（含促销）'], ['门店价', result.store_price !== undefined && result.store_price !== null ? `¥${result.store_price.toFixed(2)}` : '-', '门店特价覆盖（如有）'], ['扫描价', `¥${scannedPrice.toFixed(2)}`, '扫码枪读取的纸质价签价格']);
        console.log(priceTable.toString());
        if (issues.length > 0) {
            console.log('');
            console.log(chalk_1.default.bold('问题列表'));
            const issueTable = new cli_table3_1.default({
                head: ['类型', '代码', '严重程度', '说明'],
                colWidths: [12, 25, 12, 50]
            });
            for (const issue of issues) {
                issueTable.push([
                    issue.issue_type,
                    issue.issue_code,
                    formatSeverity(issue.severity),
                    issue.issue_message
                ]);
            }
            console.log(issueTable.toString());
        }
        if (history.length > 0) {
            console.log('');
            console.log(chalk_1.default.bold('状态历史'));
            const historyTable = new cli_table3_1.default({
                head: ['时间', '从', '到', '原因', '操作者'],
                colWidths: [22, 20, 20, 25, 15]
            });
            for (const h of history) {
                historyTable.push([
                    h.created_at || '-',
                    h.from_status ? formatStatus(h.from_status) : '-',
                    formatStatus(h.to_status),
                    h.reason || '-',
                    h.operator || '-'
                ]);
            }
            console.log(historyTable.toString());
        }
        if (corrections.length > 0) {
            console.log('');
            console.log(chalk_1.default.bold('人工修正记录'));
            for (const c of corrections) {
                const diff = JSON.parse(c.diff_json);
                console.log(`  ${c.created_at} - ${c.corrected_by}`);
                console.log(`    状态: ${formatStatus(c.old_status)} → ${formatStatus(c.new_status)}`);
                console.log(`    差异: ${JSON.stringify(diff)}`);
                if (c.comment) {
                    console.log(`    备注: ${c.comment}`);
                }
            }
        }
        console.log('');
        console.log(chalk_1.default.blue('══════════════════════════════════════════════════'));
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 查询失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('report')
    .description('生成门店汇总报告')
    .option('-s, --store <storeId>', '指定门店')
    .option('--json', '输出 JSON 格式')
    .action((options) => {
    try {
        const checkOptions = {
            storeId: options.store
        };
        const summary = (0, checker_1.getCheckSummary)(checkOptions);
        const results = (0, checker_1.getAllCheckResults)(checkOptions);
        if (options.json) {
            const report = {
                generatedAt: new Date().toISOString(),
                summary,
                results: results.map(r => ({
                    id: r.id,
                    storeId: r.store_id,
                    sku: r.sku,
                    status: r.status,
                    systemPrice: r.system_price,
                    scannedPrice: r.scanned_price,
                    checkTime: r.check_time
                }))
            };
            console.log(JSON.stringify(report, null, 2));
            process.exit(0);
        }
        console.log(chalk_1.default.blue('══════════════════════════════════════════════════════'));
        console.log(chalk_1.default.blue('  促销价签校对汇总报告'));
        console.log(chalk_1.default.blue('══════════════════════════════════════════════════════'));
        console.log('');
        console.log(chalk_1.default.gray(`生成时间: ${new Date().toISOString()}`));
        console.log('');
        const summaryTable = new cli_table3_1.default({
            head: ['状态分类', '数量', '占比', '业务建议'],
            colWidths: [22, 10, 10, 40]
        });
        const total = summary.total || 1;
        summaryTable.push([
            formatStatus('PASS'),
            summary.pass,
            `${((summary.pass / total) * 100).toFixed(1)}%`,
            '正常上架，无需处理'
        ], [
            formatStatus('MUST_REPRINT'),
            chalk_1.default.red(summary.mustReprint),
            `${((summary.mustReprint / total) * 100).toFixed(1)}%`,
            '立即重打价签，避免价格欺诈'
        ], [
            formatStatus('CAN_CONTINUE'),
            summary.canContinue,
            `${((summary.canContinue / total) * 100).toFixed(1)}%`,
            '可暂时继续使用，建议下次打印更新'
        ], [
            formatStatus('NEEDS_MANUAL_CHECK'),
            summary.needsManualCheck,
            `${((summary.needsManualCheck / total) * 100).toFixed(1)}%`,
            '等待人工审核确认'
        ], [
            formatStatus('MANUALLY_APPROVED'),
            summary.manuallyApproved,
            `${((summary.manuallyApproved / total) * 100).toFixed(1)}%`,
            '已人工放行'
        ], [
            formatStatus('MANUALLY_REJECTED'),
            summary.manuallyRejected,
            `${((summary.manuallyRejected / total) * 100).toFixed(1)}%`,
            '已人工拒绝'
        ]);
        console.log(summaryTable.toString());
        console.log('');
        console.log(chalk_1.default.bold('业务闭环判断'));
        const canGoLive = summary.mustReprint === 0 && summary.needsManualCheck === 0;
        if (canGoLive) {
            console.log(chalk_1.default.green('  ✓ 所有价签已校对完成，可以上架促销！'));
        }
        else {
            console.log(chalk_1.default.red('  ✗ 存在待处理问题，暂不建议上架'));
            if (summary.mustReprint > 0) {
                console.log(chalk_1.default.red(`    - ${summary.mustReprint} 张价签必须重打`));
            }
            if (summary.needsManualCheck > 0) {
                console.log(chalk_1.default.yellow(`    - ${summary.needsManualCheck} 张价签等待人工确认`));
            }
        }
        console.log('');
        console.log(chalk_1.default.blue('══════════════════════════════════════════════════════'));
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 生成报告失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
program
    .command('correct')
    .description('人工修正校对结果状态')
    .argument('<resultId>', '校对结果ID')
    .argument('<newStatus>', '新状态 (MANUALLY_APPROVED|MANUALLY_REJECTED)')
    .option('-o, --operator <name>', '操作者名称', 'Unknown')
    .option('-c, --comment <text>', '备注说明')
    .action((resultId, newStatus, options) => {
    try {
        const validStatuses = ['MANUALLY_APPROVED', 'MANUALLY_REJECTED'];
        if (!validStatuses.includes(newStatus)) {
            console.error(chalk_1.default.red(`✗ 无效状态: ${newStatus}，请使用: MANUALLY_APPROVED 或 MANUALLY_REJECTED`));
            process.exit(1);
        }
        let result;
        if (newStatus === 'MANUALLY_APPROVED') {
            result = (0, correction_1.approveResult)(resultId, options.operator, options.comment);
        }
        else {
            result = (0, correction_1.rejectResult)(resultId, options.operator, options.comment);
        }
        if (!result.success) {
            console.error(chalk_1.default.red(`✗ ${result.message}`));
            process.exit(1);
        }
        console.log(chalk_1.default.green(`✓ ${result.message}`));
        console.log(chalk_1.default.gray(`  操作者: ${options.operator}`));
        if (options.comment) {
            console.log(chalk_1.default.gray(`  备注: ${options.comment}`));
        }
        process.exit(0);
    }
    catch (err) {
        console.error(chalk_1.default.red(`✗ 修正失败: ${err.message}`));
        process.exit(1);
    }
    finally {
        (0, database_1.closeDb)();
    }
});
function runCLI(argv = process.argv) {
    program.parse(argv);
}
