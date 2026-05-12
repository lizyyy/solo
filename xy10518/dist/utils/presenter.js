"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_LABELS = exports.RISK_LABELS = exports.RISK_COLORS = exports.STATUS_LABELS = exports.STATUS_COLORS = void 0;
exports.formatStatus = formatStatus;
exports.formatRisk = formatRisk;
exports.printBatchHeader = printBatchHeader;
exports.printInspections = printInspections;
exports.printConcessions = printConcessions;
exports.printHistory = printHistory;
exports.printBatchSummary = printBatchSummary;
exports.printBatchList = printBatchList;
exports.printReport = printReport;
exports.printError = printError;
exports.printSuccess = printSuccess;
exports.printTitle = printTitle;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const rules_1 = require("../engine/rules");
exports.STATUS_COLORS = {
    CREATED: chalk_1.default.gray,
    INITIAL_INSPECTION: chalk_1.default.yellow,
    PENDING_REINSPECTION: chalk_1.default.yellowBright,
    REINSPECTION: chalk_1.default.magenta,
    PENDING_CONCESSION: chalk_1.default.cyan,
    CONCESSION_APPROVED: chalk_1.default.greenBright,
    PASSED: chalk_1.default.green,
    REJECTED: chalk_1.default.red,
    REWORK: chalk_1.default.magentaBright,
    CLOSED: chalk_1.default.gray.dim
};
exports.STATUS_LABELS = {
    CREATED: '已创建',
    INITIAL_INSPECTION: '初检中',
    PENDING_REINSPECTION: '待复检',
    REINSPECTION: '复检中',
    PENDING_CONCESSION: '待让步放行',
    CONCESSION_APPROVED: '让步放行通过',
    PASSED: '通过',
    REJECTED: '拒收',
    REWORK: '返工',
    CLOSED: '已关闭'
};
exports.RISK_COLORS = {
    NONE: chalk_1.default.green,
    LOW: chalk_1.default.yellow,
    MEDIUM: chalk_1.default.magenta,
    HIGH: chalk_1.default.red,
    CRITICAL: chalk_1.default.redBright.bold
};
exports.RISK_LABELS = {
    NONE: '无',
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高',
    CRITICAL: '严重'
};
exports.ACTION_LABELS = {
    INITIAL_INSPECT: '初检',
    REINSPECT: '复检',
    REQUEST_CONCESSION: '申请让步放行',
    APPROVE_CONCESSION: '批准让步放行',
    REJECT_CONCESSION: '拒绝让步放行',
    APPROVE_REWORK: '批准返工',
    MANUAL_CORRECTION: '人工修正',
    CLOSE_BATCH: '关闭批次'
};
function formatStatus(status) {
    const color = exports.STATUS_COLORS[status] || chalk_1.default.white;
    const label = exports.STATUS_LABELS[status] || status;
    return color(`[${label}]`);
}
function formatRisk(risk) {
    const color = exports.RISK_COLORS[risk] || chalk_1.default.white;
    const label = exports.RISK_LABELS[risk] || risk;
    return color(`${label}风险`);
}
function printBatchHeader(batch) {
    console.log('\n' + '='.repeat(80));
    console.log(chalk_1.default.bold(`  批次信息: ${batch.batchNumber}`));
    console.log('='.repeat(80));
    console.log(`  产品: ${chalk_1.default.cyan(batch.productName)} (${batch.productCode})`);
    console.log(`  数量: ${chalk_1.default.cyan(batch.quantity.toString())} 件`);
    console.log(`  生产日期: ${chalk_1.default.cyan(batch.productionDate)}`);
    console.log(`  生产线: ${chalk_1.default.cyan(batch.productionLine)}`);
    console.log(`  当前状态: ${formatStatus(batch.status)}`);
    console.log(`  质量风险: ${formatRisk(batch.currentRisk)}`);
    console.log(`  创建时间: ${batch.createdAt}`);
    console.log(`  更新时间: ${batch.updatedAt}`);
}
function printInspections(batch) {
    if (batch.inspections.length === 0) {
        console.log(`\n  ${chalk_1.default.yellow('暂无检验记录')}`);
        return;
    }
    console.log('\n' + chalk_1.default.bold('  检验记录:'));
    console.log('  ' + '-'.repeat(75));
    batch.inspections.forEach((inspection, index) => {
        const isReinspection = index > 0;
        const type = isReinspection ? '复检' : '初检';
        const resultColor = inspection.result === 'PASS' ? chalk_1.default.green : chalk_1.default.red;
        console.log(`\n  ${chalk_1.default.bold(`[${type}]`)} 第 ${index + 1} 次检验`);
        console.log(`    检验员: ${inspection.inspector}`);
        console.log(`    时间: ${inspection.timestamp}`);
        console.log(`    抽样数: ${inspection.sampleCount} / 已检: ${inspection.inspectedCount}`);
        console.log(`    缺陷数: ${inspection.defectCount}`);
        console.log(`    缺陷详情: ${(0, rules_1.formatDefects)(inspection.defects)}`);
        console.log(`    缺陷评分: ${chalk_1.default.yellow((0, rules_1.calculateDefectScore)(inspection.defects).toString())}`);
        console.log(`    结果: ${resultColor(inspection.result === 'PASS' ? '通过' : '不合格')}`);
        if (inspection.notes) {
            console.log(`    备注: ${inspection.notes}`);
        }
    });
}
function printConcessions(batch) {
    if (batch.concessionRequests.length === 0) {
        console.log(`\n  ${chalk_1.default.yellow('暂无让步放行记录')}`);
        return;
    }
    console.log('\n' + chalk_1.default.bold('  让步放行记录:'));
    console.log('  ' + '-'.repeat(75));
    batch.concessionRequests.forEach((concession, index) => {
        const statusColor = concession.approvalStatus === 'APPROVED' ? chalk_1.default.green :
            concession.approvalStatus === 'REJECTED' ? chalk_1.default.red : chalk_1.default.yellow;
        console.log(`\n  ${chalk_1.default.bold(`[申请 ${index + 1}]`)}`);
        console.log(`    申请人: ${concession.requestedBy}`);
        console.log(`    申请时间: ${concession.requestedAt}`);
        console.log(`    原因: ${concession.reason}`);
        console.log(`    理由: ${concession.justification}`);
        console.log(`    风险等级: ${formatRisk(concession.riskLevel)}`);
        console.log(`    状态: ${statusColor(concession.approvalStatus === 'PENDING' ? '待审批' :
            concession.approvalStatus === 'APPROVED' ? '已批准' : '已拒绝')}`);
        if (concession.approvedBy) {
            console.log(`    审批人: ${chalk_1.default.green(concession.approvedBy)}`);
            console.log(`    审批时间: ${concession.approvedAt}`);
            if (concession.approvalNotes) {
                console.log(`    审批意见: ${concession.approvalNotes}`);
            }
        }
    });
}
function printHistory(batch, limit) {
    if (batch.history.length === 0) {
        console.log(`\n  ${chalk_1.default.yellow('暂无历史记录')}`);
        return;
    }
    const history = limit ? batch.history.slice(-limit) : batch.history;
    console.log('\n' + chalk_1.default.bold('  历史轨迹:'));
    console.log('  ' + '-'.repeat(75));
    history.forEach((entry, index) => {
        const actionLabel = exports.ACTION_LABELS[entry.actionType] || entry.actionType;
        const actionColor = entry.actionType === 'MANUAL_CORRECTION' ? chalk_1.default.magentaBright :
            entry.actionType.includes('APPROVE') ? chalk_1.default.green :
                entry.actionType === 'CLOSE_BATCH' ? chalk_1.default.gray :
                    chalk_1.default.cyan;
        console.log(`\n  ${chalk_1.default.bold(`#${index + 1}`)} ${actionColor(actionLabel)}`);
        console.log(`    操作者: ${entry.actor}`);
        console.log(`    时间: ${entry.timestamp}`);
        console.log(`    状态变更: ${formatStatus(entry.previousStatus)} → ${formatStatus(entry.newStatus)}`);
        if (entry.reason) {
            console.log(`    原因: ${entry.reason}`);
        }
        if (entry.differences && entry.differences.length > 0) {
            console.log(`    变更差异:`);
            entry.differences.forEach(diff => {
                console.log(`      - ${chalk_1.default.cyan(diff.field)}: ${chalk_1.default.red(diff.oldValue)} → ${chalk_1.default.green(diff.newValue)}`);
            });
        }
    });
}
function printBatchSummary(batch) {
    printBatchHeader(batch);
    printInspections(batch);
    printConcessions(batch);
    printHistory(batch);
    console.log('\n' + '='.repeat(80) + '\n');
}
function printBatchList(batches) {
    if (batches.length === 0) {
        console.log(chalk_1.default.yellow('\n  暂无批次数据\n'));
        return;
    }
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.bold('批次号'),
            chalk_1.default.bold('产品'),
            chalk_1.default.bold('数量'),
            chalk_1.default.bold('状态'),
            chalk_1.default.bold('风险'),
            chalk_1.default.bold('检验次数'),
            chalk_1.default.bold('让步放行'),
            chalk_1.default.bold('更新时间')
        ],
        colWidths: [22, 20, 10, 16, 10, 12, 12, 20]
    });
    batches.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    batches.forEach(batch => {
        const concessionsApproved = batch.concessionRequests.filter(c => c.approvalStatus === 'APPROVED').length;
        table.push([
            chalk_1.default.cyan(batch.batchNumber),
            batch.productName.length > 15 ? batch.productName.slice(0, 15) + '...' : batch.productName,
            batch.quantity.toString(),
            formatStatus(batch.status),
            formatRisk(batch.currentRisk),
            batch.inspections.length.toString(),
            concessionsApproved > 0 ? chalk_1.default.green(`✓ ${concessionsApproved}`) : chalk_1.default.gray('-'),
            new Date(batch.updatedAt).toLocaleString('zh-CN')
        ]);
    });
    console.log('\n' + table.toString() + '\n');
}
function printReport(batches) {
    const total = batches.length;
    const passed = batches.filter(b => b.status === 'PASSED' || b.status === 'CLOSED' &&
        b.history.some(h => h.newStatus === 'PASSED')).length;
    const failed = batches.filter(b => b.status === 'REJECTED').length;
    const rework = batches.filter(b => b.status === 'REWORK').length;
    const concessions = batches.filter(b => b.concessionRequests.some(c => c.approvalStatus === 'APPROVED')).length;
    const pending = batches.filter(b => ['PENDING_REINSPECTION', 'PENDING_CONCESSION', 'REINSPECTION', 'INITIAL_INSPECTION'].includes(b.status)).length;
    const highRisk = batches.filter(b => ['HIGH', 'CRITICAL'].includes(b.currentRisk)).length;
    console.log('\n' + '='.repeat(80));
    console.log(chalk_1.default.bold('  质量检验汇总报告'));
    console.log('='.repeat(80));
    const summaryTable = new cli_table3_1.default({
        head: [chalk_1.default.bold('指标'), chalk_1.default.bold('数量'), chalk_1.default.bold('占比')],
        colWidths: [30, 15, 15]
    });
    summaryTable.push([chalk_1.default.cyan('总批次数'), total.toString(), '100%'], [chalk_1.default.green('通过批次'), passed.toString(), `${total > 0 ? Math.round(passed / total * 100) : 0}%`], [chalk_1.default.red('拒收批次'), failed.toString(), `${total > 0 ? Math.round(failed / total * 100) : 0}%`], [chalk_1.default.magenta('返工批次'), rework.toString(), `${total > 0 ? Math.round(rework / total * 100) : 0}%`], [chalk_1.default.greenBright('让步放行'), concessions.toString(), `${total > 0 ? Math.round(concessions / total * 100) : 0}%`], [chalk_1.default.yellow('待处理'), pending.toString(), `${total > 0 ? Math.round(pending / total * 100) : 0}%`], [chalk_1.default.redBright('高风险批次'), highRisk.toString(), `${total > 0 ? Math.round(highRisk / total * 100) : 0}%`]);
    console.log('\n' + summaryTable.toString());
    if (highRisk > 0) {
        console.log('\n' + chalk_1.default.bold.red('  ⚠ 高风险批次详情:'));
        batches.filter(b => ['HIGH', 'CRITICAL'].includes(b.currentRisk)).forEach(batch => {
            console.log(`    - ${chalk_1.default.cyan(batch.batchNumber)}: ${batch.productName} - ${formatRisk(batch.currentRisk)}`);
        });
    }
    if (pending > 0) {
        console.log('\n' + chalk_1.default.bold.yellow('  ⏳ 待处理批次详情:'));
        batches.filter(b => ['PENDING_REINSPECTION', 'PENDING_CONCESSION', 'REINSPECTION', 'INITIAL_INSPECTION'].includes(b.status)).forEach(batch => {
            console.log(`    - ${chalk_1.default.cyan(batch.batchNumber)}: ${batch.productName} - ${formatStatus(batch.status)}`);
        });
    }
    console.log('\n' + '='.repeat(80) + '\n');
}
function printError(message, errors) {
    console.log('\n' + chalk_1.default.red.bold('  ✖ 操作失败'));
    console.log(`  ${message}`);
    if (errors && errors.length > 0) {
        console.log('\n  错误详情:');
        errors.forEach(err => console.log(`    - ${chalk_1.default.red(err)}`));
    }
    console.log();
}
function printSuccess(message, warnings) {
    console.log('\n' + chalk_1.default.green.bold('  ✓ 操作成功'));
    console.log(`  ${message}`);
    if (warnings && warnings.length > 0) {
        console.log('\n  警告信息:');
        warnings.forEach(warn => console.log(`    - ${chalk_1.default.yellow(warn)}`));
    }
    console.log();
}
function printTitle(title) {
    console.log('\n' + '─'.repeat(80));
    console.log(chalk_1.default.bold(`  ${title}`));
    console.log('─'.repeat(80) + '\n');
}
//# sourceMappingURL=presenter.js.map