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
const chalk = require("chalk");
const Table = require("cli-table3");
const data_loader_1 = require("./data-loader");
const settlement_engine_1 = require("./settlement-engine");
const fs = __importStar(require("fs"));
const json2csv_1 = require("json2csv");
const program = new commander_1.Command();
const formatMoney = (amount) => {
    return '¥' + amount.toFixed(2);
};
const formatPercentage = (percent) => {
    const sign = percent >= 0 ? '+' : '';
    return sign + percent.toFixed(2) + '%';
};
const loadData = (options) => {
    const loader = new data_loader_1.DataLoader();
    loader.loadConfig(options.config);
    loader.loadOrders(options.orders);
    loader.loadRefunds(options.refunds);
    loader.loadParties(options.parties);
    return loader;
};
program
    .name('srs')
    .description('分账规则模拟 CLI - 模拟新旧规则的分账差异分析')
    .version('1.0.0');
program
    .command('check')
    .description('检查数据完整性和配置有效性')
    .requiredOption('--config <path>', '规则配置文件路径')
    .requiredOption('--orders <path>', '订单数据文件路径')
    .requiredOption('--refunds <path>', '退款数据文件路径')
    .requiredOption('--parties <path>', '参与方数据文件路径')
    .action((options) => {
    console.log(chalk.blue('=== 数据检查 ==='));
    console.log('');
    const loader = loadData(options);
    const config = loader.getConfig();
    const orders = loader.getAllOrders();
    console.log(chalk.green('✓ 配置文件: ' + options.config));
    console.log(chalk.green('✓ 订单文件: ' + options.orders + ' (' + orders.length + ' 条)'));
    console.log(chalk.green('✓ 退款文件: ' + options.refunds));
    console.log(chalk.green('✓ 参与方文件: ' + options.parties));
    console.log('');
    console.log(chalk.blue('--- 规则版本 ---'));
    console.log('旧规则版本: ' + config.oldRules.map(r => r.version).join(', '));
    console.log('新规则版本: ' + config.newRules.map(r => r.version).join(', '));
    console.log('');
    const anomalies = loader.validateAll();
    const duplicates = loader.getDuplicateOrders();
    if (anomalies.length > 0 || duplicates.length > 0) {
        console.log(chalk.yellow('⚠  发现问题:'));
        if (duplicates.length > 0) {
            console.log(chalk.yellow('  - 重复订单: ' + duplicates.length + ' 条'));
        }
        anomalies.forEach(a => {
            const icon = a.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠');
            console.log(icon + ' ' + a.message);
        });
    }
    else {
        console.log(chalk.green('✓ 数据检查通过，未发现问题'));
    }
});
program
    .command('simulate')
    .description('按指定规则版本模拟所有订单结算')
    .requiredOption('--config <path>', '规则配置文件路径')
    .requiredOption('--orders <path>', '订单数据文件路径')
    .requiredOption('--refunds <path>', '退款数据文件路径')
    .requiredOption('--parties <path>', '参与方数据文件路径')
    .option('--rules <type>', '使用的规则版本: old 或 new', 'old')
    .action((options) => {
    console.log(chalk.blue('=== 模拟结算 ==='));
    console.log('使用规则: ' + (options.rules === 'new' ? '新规则' : '旧规则'));
    console.log('');
    const loader = loadData(options);
    const engine = new settlement_engine_1.SettlementEngine(loader);
    const results = engine.simulateAll(options.rules === 'new' ? 'new' : 'old');
    const table = new Table({
        head: ['订单ID', '金额', '退款', '净额', '平台', '商家', '达人', '服务商', '异常'],
        colWidths: [15, 12, 12, 12, 12, 12, 12, 12, 8]
    });
    let platformTotal = 0;
    let merchantTotal = 0;
    let talentTotal = 0;
    let spTotal = 0;
    let orderTotal = 0;
    let refundTotal = 0;
    results.forEach(result => {
        const getAmount = (type) => {
            const detail = result.details.find(d => d.partyType === type);
            return detail?.finalAmount || 0;
        };
        const platform = getAmount('platform');
        const merchant = getAmount('merchant');
        const talent = getAmount('talent');
        const sp = getAmount('serviceProvider');
        platformTotal += platform;
        merchantTotal += merchant;
        talentTotal += talent;
        spTotal += sp;
        orderTotal += result.totalAmount;
        refundTotal += result.refundAmount;
        table.push([
            result.orderId,
            formatMoney(result.totalAmount),
            formatMoney(result.refundAmount),
            formatMoney(result.netAmount),
            formatMoney(platform),
            formatMoney(merchant),
            formatMoney(talent),
            formatMoney(sp),
            result.anomalies.length > 0 ? chalk.red(result.anomalies.length) : '-'
        ]);
    });
    console.log(table.toString());
    console.log('');
    const summary = new Table({
        head: ['指标', '金额'],
        colWidths: [20, 20]
    });
    summary.push(['订单总金额', formatMoney(orderTotal)], ['退款总金额', formatMoney(refundTotal)], ['平台总收入', formatMoney(platformTotal)], ['商家总收入', formatMoney(merchantTotal)], ['达人总佣金', formatMoney(talentTotal)], ['服务商总分成', formatMoney(spTotal)]);
    console.log(chalk.blue('--- 汇总统计 ---'));
    console.log(summary.toString());
});
program
    .command('diff')
    .description('对比新旧规则的结算差异')
    .requiredOption('--config <path>', '规则配置文件路径')
    .requiredOption('--orders <path>', '订单数据文件路径')
    .requiredOption('--refunds <path>', '退款数据文件路径')
    .requiredOption('--parties <path>', '参与方数据文件路径')
    .option('--top <number>', '显示差异最大的前 N 条订单', '10')
    .action((options) => {
    console.log(chalk.blue('=== 新旧规则差异分析 ==='));
    console.log('生成时间: ' + new Date().toLocaleString());
    console.log('');
    const loader = loadData(options);
    const engine = new settlement_engine_1.SettlementEngine(loader);
    const result = engine.calculateDifferences();
    const summary = new Table({
        head: ['参与方', '旧规则', '新规则', '差异', '差异率'],
        colWidths: [12, 15, 15, 15, 12]
    });
    const platformDiff = result.newSettlementSummary.platformTotal - result.oldSettlementSummary.platformTotal;
    const merchantDiff = result.newSettlementSummary.merchantTotal - result.oldSettlementSummary.merchantTotal;
    const talentDiff = result.newSettlementSummary.talentTotal - result.oldSettlementSummary.talentTotal;
    const spDiff = result.newSettlementSummary.serviceProviderTotal - result.oldSettlementSummary.serviceProviderTotal;
    const grandDiff = result.newSettlementSummary.grandTotal - result.oldSettlementSummary.grandTotal;
    const calcDiffPct = (diff, oldValue) => oldValue > 0 ? (diff / oldValue) * 100 : 0;
    const formatDiffCell = (diff, diffPct) => {
        const diffStr = formatMoney(diff);
        const pctStr = formatPercentage(diffPct);
        if (diff > 0)
            return chalk.green(diffStr);
        if (diff < 0)
            return chalk.red(diffStr);
        return diffStr;
    };
    summary.push(['平台', formatMoney(result.oldSettlementSummary.platformTotal), formatMoney(result.newSettlementSummary.platformTotal),
        formatDiffCell(platformDiff, calcDiffPct(platformDiff, result.oldSettlementSummary.platformTotal)),
        formatPercentage(calcDiffPct(platformDiff, result.oldSettlementSummary.platformTotal))], ['商家', formatMoney(result.oldSettlementSummary.merchantTotal), formatMoney(result.newSettlementSummary.merchantTotal),
        formatDiffCell(merchantDiff, calcDiffPct(merchantDiff, result.oldSettlementSummary.merchantTotal)),
        formatPercentage(calcDiffPct(merchantDiff, result.oldSettlementSummary.merchantTotal))], ['达人', formatMoney(result.oldSettlementSummary.talentTotal), formatMoney(result.newSettlementSummary.talentTotal),
        formatDiffCell(talentDiff, calcDiffPct(talentDiff, result.oldSettlementSummary.talentTotal)),
        formatPercentage(calcDiffPct(talentDiff, result.oldSettlementSummary.talentTotal))], ['服务商', formatMoney(result.oldSettlementSummary.serviceProviderTotal), formatMoney(result.newSettlementSummary.serviceProviderTotal),
        formatDiffCell(spDiff, calcDiffPct(spDiff, result.oldSettlementSummary.serviceProviderTotal)),
        formatPercentage(calcDiffPct(spDiff, result.oldSettlementSummary.serviceProviderTotal))], ['总计', formatMoney(result.oldSettlementSummary.grandTotal), formatMoney(result.newSettlementSummary.grandTotal),
        formatDiffCell(grandDiff, calcDiffPct(grandDiff, result.oldSettlementSummary.grandTotal)),
        formatPercentage(calcDiffPct(grandDiff, result.oldSettlementSummary.grandTotal))]);
    console.log(chalk.blue('--- 总差异汇总 ---'));
    console.log(summary.toString());
    console.log('');
    const sortedDiffs = [...result.differences].sort((a, b) => Math.abs(b.totalDiff) - Math.abs(a.totalDiff));
    const topN = Math.min(parseInt(options.top), sortedDiffs.length);
    if (topN > 0) {
        console.log(chalk.blue('--- 差异最大的前 ' + topN + ' 条订单 ---'));
        const diffTable = new Table({
            head: ['订单ID', '总差异', '平台', '商家', '达人', '服务商', '差异率', '规则变化'],
            colWidths: [15, 15, 12, 12, 12, 12, 10, 10]
        });
        for (let i = 0; i < topN; i++) {
            const diff = sortedDiffs[i];
            diffTable.push([
                diff.orderId,
                formatDiffCell(diff.totalDiff, diff.diffPercentage),
                formatDiffCell(diff.platformDiff, 0),
                formatDiffCell(diff.merchantDiff, 0),
                formatDiffCell(diff.talentDiff, 0),
                formatDiffCell(diff.serviceProviderDiff, 0),
                formatPercentage(diff.diffPercentage),
                diff.hasRuleVersionChange ? chalk.yellow('是') : '-'
            ]);
        }
        console.log(diffTable.toString());
        console.log('');
    }
    if (result.cannotSettleOrders.length > 0) {
        console.log(chalk.red('--- 无法自动结算的订单 (' + result.cannotSettleOrders.length + ' 条) ---'));
        const errorTable = new Table({
            head: ['订单ID', '原因', '异常数'],
            colWidths: [20, 40, 10]
        });
        result.cannotSettleOrders.forEach(order => {
            errorTable.push([
                order.orderId,
                order.anomalies[0]?.message || order.reason,
                order.anomalies.length
            ]);
        });
        console.log(errorTable.toString());
        console.log('');
    }
    const warnings = result.anomalies.filter(a => a.severity === 'warning');
    const errors = result.anomalies.filter(a => a.severity === 'error');
    console.log(chalk.blue('--- 异常统计 ---'));
    console.log('警告: ' + warnings.length + ' 条');
    console.log('错误: ' + errors.length + ' 条');
    console.log('');
    console.log(chalk.yellow('⚠  注意: 此结果仅供参考，不会覆盖真实结算数据'));
    console.log(chalk.yellow('   请人工审核后再决定是否应用新规则'));
});
program
    .command('explain <orderId>')
    .description('详细解释单笔订单的差异原因')
    .requiredOption('--config <path>', '规则配置文件路径')
    .requiredOption('--orders <path>', '订单数据文件路径')
    .requiredOption('--refunds <path>', '退款数据文件路径')
    .requiredOption('--parties <path>', '参与方数据文件路径')
    .action((orderId, options) => {
    console.log(chalk.blue('=== 订单详细解释 ==='));
    console.log('订单ID: ' + orderId);
    console.log('');
    const loader = loadData(options);
    const engine = new settlement_engine_1.SettlementEngine(loader);
    const explanation = engine.explainOrder(orderId);
    if (!explanation) {
        console.log(chalk.red('✗ 未找到订单: ' + orderId));
        return;
    }
    console.log(chalk.blue('--- 订单基本信息 ---'));
    const infoTable = new Table({
        head: ['项目', '内容'],
        colWidths: [15, 40]
    });
    infoTable.push(['订单日期', explanation.orderDate], ['结算日期', explanation.settlementDate], ['订单金额', formatMoney(explanation.orderAmount)], ['退款金额', formatMoney(explanation.refundAmount)], ['净额', formatMoney(explanation.netAmount)], ['旧规则版本', explanation.oldSettlement.ruleVersion], ['新规则版本', explanation.newSettlement.ruleVersion]);
    console.log(infoTable.toString());
    console.log('');
    console.log(chalk.blue('--- 参与方对比分析 ---'));
    const compareTable = new Table({
        head: ['参与方', '旧金额', '新金额', '差异', '差异率', '原因'],
        colWidths: [10, 12, 12, 12, 10, 35]
    });
    explanation.comparison.forEach(comp => {
        const diffCell = comp.diff > 0 ? chalk.green(formatMoney(comp.diff)) :
            comp.diff < 0 ? chalk.red(formatMoney(comp.diff)) : formatMoney(comp.diff);
        const pctCell = comp.diffPercentage > 0 ? chalk.green(formatPercentage(comp.diffPercentage)) :
            comp.diffPercentage < 0 ? chalk.red(formatPercentage(comp.diffPercentage)) : formatPercentage(comp.diffPercentage);
        compareTable.push([
            comp.partyType,
            formatMoney(comp.oldAmount),
            formatMoney(comp.newAmount),
            diffCell,
            pctCell,
            comp.reason
        ]);
    });
    console.log(compareTable.toString());
    console.log('');
    console.log(chalk.blue('--- 详细计算过程 (旧规则) ---'));
    const oldDetailTable = new Table({
        head: ['参与方', '基础金额', '费率', '计算金额', '退款抵扣', '保底', '最终金额'],
        colWidths: [10, 12, 10, 12, 12, 10, 12]
    });
    explanation.oldSettlement.details.forEach(detail => {
        oldDetailTable.push([
            detail.partyType,
            formatMoney(detail.baseAmount),
            (detail.rate * 100).toFixed(2) + '%',
            formatMoney(detail.calculatedAmount),
            formatMoney(detail.refundDeduction),
            detail.guaranteeApplied ? chalk.blue(formatMoney(detail.guaranteeAmount || 0)) : '-',
            formatMoney(detail.finalAmount)
        ]);
    });
    console.log(oldDetailTable.toString());
    console.log('');
    console.log(chalk.blue('--- 详细计算过程 (新规则) ---'));
    const newDetailTable = new Table({
        head: ['参与方', '基础金额', '费率', '计算金额', '退款抵扣', '保底', '最终金额'],
        colWidths: [10, 12, 10, 12, 12, 10, 12]
    });
    explanation.newSettlement.details.forEach(detail => {
        newDetailTable.push([
            detail.partyType,
            formatMoney(detail.baseAmount),
            (detail.rate * 100).toFixed(2) + '%',
            formatMoney(detail.calculatedAmount),
            formatMoney(detail.refundDeduction),
            detail.guaranteeApplied ? chalk.blue(formatMoney(detail.guaranteeAmount || 0)) : '-',
            formatMoney(detail.finalAmount)
        ]);
    });
    console.log(newDetailTable.toString());
    console.log('');
    if (explanation.anomalies.length > 0) {
        console.log(chalk.yellow('--- 异常信息 ---'));
        explanation.anomalies.forEach(a => {
            const icon = a.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠');
            console.log(icon + ' ' + a.message);
        });
    }
});
program
    .command('export')
    .description('导出模拟结果到文件')
    .requiredOption('--config <path>', '规则配置文件路径')
    .requiredOption('--orders <path>', '订单数据文件路径')
    .requiredOption('--refunds <path>', '退款数据文件路径')
    .requiredOption('--parties <path>', '参与方数据文件路径')
    .option('--format <type>', '导出格式: json 或 csv', 'json')
    .option('--output <path>', '输出文件路径', './simulation-result')
    .action((options) => {
    console.log(chalk.blue('=== 导出模拟结果 ==='));
    const loader = loadData(options);
    const engine = new settlement_engine_1.SettlementEngine(loader);
    const result = engine.calculateDifferences();
    const outputPath = options.output + '.' + options.format;
    if (options.format === 'json') {
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    }
    else {
        const fields = [
            'orderId', 'orderAmount', 'refundAmount', 'oldRuleVersion', 'newRuleVersion',
            'platformDiff', 'merchantDiff', 'talentDiff', 'serviceProviderDiff',
            'totalDiff', 'diffPercentage', 'hasGuaranteeChange', 'hasRuleVersionChange'
        ];
        const parser = new json2csv_1.Parser({ fields });
        const csv = parser.parse(result.differences);
        const summaryCsv = '参与方,旧规则金额,新规则金额,差异,差异率\n' +
            '平台,' + result.oldSettlementSummary.platformTotal + ',' + result.newSettlementSummary.platformTotal + ',' +
            (result.newSettlementSummary.platformTotal - result.oldSettlementSummary.platformTotal) + ',' +
            (result.oldSettlementSummary.platformTotal > 0 ?
                ((result.newSettlementSummary.platformTotal - result.oldSettlementSummary.platformTotal) /
                    result.oldSettlementSummary.platformTotal * 100).toFixed(2) : '0') + '%\n' +
            '商家,' + result.oldSettlementSummary.merchantTotal + ',' + result.newSettlementSummary.merchantTotal + ',' +
            (result.newSettlementSummary.merchantTotal - result.oldSettlementSummary.merchantTotal) + ',' +
            (result.oldSettlementSummary.merchantTotal > 0 ?
                ((result.newSettlementSummary.merchantTotal - result.oldSettlementSummary.merchantTotal) /
                    result.oldSettlementSummary.merchantTotal * 100).toFixed(2) : '0') + '%\n' +
            '达人,' + result.oldSettlementSummary.talentTotal + ',' + result.newSettlementSummary.talentTotal + ',' +
            (result.newSettlementSummary.talentTotal - result.oldSettlementSummary.talentTotal) + ',' +
            (result.oldSettlementSummary.talentTotal > 0 ?
                ((result.newSettlementSummary.talentTotal - result.oldSettlementSummary.talentTotal) /
                    result.oldSettlementSummary.talentTotal * 100).toFixed(2) : '0') + '%\n' +
            '服务商,' + result.oldSettlementSummary.serviceProviderTotal + ',' + result.newSettlementSummary.serviceProviderTotal + ',' +
            (result.newSettlementSummary.serviceProviderTotal - result.oldSettlementSummary.serviceProviderTotal) + ',' +
            (result.oldSettlementSummary.serviceProviderTotal > 0 ?
                ((result.newSettlementSummary.serviceProviderTotal - result.oldSettlementSummary.serviceProviderTotal) /
                    result.oldSettlementSummary.serviceProviderTotal * 100).toFixed(2) : '0') + '%\n';
        fs.writeFileSync(outputPath, summaryCsv + '\n--- 订单差异 ---\n' + csv);
    }
    console.log(chalk.green('✓ 导出成功: ' + outputPath));
    console.log(chalk.yellow('⚠  此文件包含待审批的影响分析，请不要直接用于真实结算'));
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map