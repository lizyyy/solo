"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.colors = void 0;
exports.formatResult = formatResult;
exports.formatSeverity = formatSeverity;
exports.formatAmount = formatAmount;
exports.formatDate = formatDate;
exports.createSummaryTable = createSummaryTable;
exports.createIssuesTable = createIssuesTable;
exports.printSection = printSection;
exports.printSuccess = printSuccess;
exports.printError = printError;
exports.printWarning = printWarning;
exports.printInfo = printInfo;
exports.printStatus = printStatus;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
exports.colors = {
    success: chalk_1.default.green,
    warning: chalk_1.default.yellow,
    error: chalk_1.default.red,
    info: chalk_1.default.blue,
    highlight: chalk_1.default.cyan,
    muted: chalk_1.default.gray,
    bold: chalk_1.default.bold
};
function formatResult(result) {
    const map = {
        auto_pass: { label: '自动通过', color: exports.colors.success },
        needs_reissue: { label: '需补开', color: exports.colors.error },
        manual_review: { label: '人工复核', color: exports.colors.warning },
        correction_suggested: { label: '纠错建议', color: exports.colors.info }
    };
    const r = map[result];
    return r.color(`[${r.label}]`);
}
function formatSeverity(severity) {
    const map = {
        error: { label: '错误', color: exports.colors.error },
        warning: { label: '警告', color: exports.colors.warning },
        info: { label: '提示', color: exports.colors.info }
    };
    const s = map[severity];
    return s.color(s.label);
}
function formatAmount(amount) {
    return `¥${amount.toFixed(2)}`;
}
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}
function createSummaryTable(reports) {
    const table = new cli_table3_1.default({
        head: [
            exports.colors.bold('发票号'),
            exports.colors.bold('报销单号'),
            exports.colors.bold('结果'),
            exports.colors.bold('通过'),
            exports.colors.bold('警告'),
            exports.colors.bold('错误'),
            exports.colors.bold('检查时间')
        ],
        colWidths: [20, 16, 14, 8, 8, 8, 22]
    });
    for (const r of reports) {
        table.push([
            r.invoiceNumber,
            r.reimbursementNumber || '-',
            formatResult(r.result),
            String(r.passCount),
            String(r.warnCount),
            String(r.errorCount),
            formatDate(r.checkedAt)
        ]);
    }
    return table;
}
function createIssuesTable(issues) {
    const table = new cli_table3_1.default({
        head: [
            exports.colors.bold('类型'),
            exports.colors.bold('标题'),
            exports.colors.bold('描述'),
            exports.colors.bold('建议')
        ],
        colWidths: [12, 24, 48, 40],
        wordWrap: true
    });
    for (const issue of issues) {
        table.push([
            formatSeverity(issue.severity),
            issue.title,
            issue.description,
            issue.suggestion || '-'
        ]);
    }
    return table;
}
function printSection(title, content) {
    console.log('\n' + exports.colors.bold(`=== ${title} ===`));
    console.log(content);
}
function printSuccess(message) {
    console.log(exports.colors.success(`✓ ${message}`));
}
function printError(message) {
    console.log(exports.colors.error(`✗ ${message}`));
}
function printWarning(message) {
    console.log(exports.colors.warning(`⚠ ${message}`));
}
function printInfo(message) {
    console.log(exports.colors.info(`ℹ ${message}`));
}
function printStatus(status, message) {
    const statusMap = {
        pending: exports.colors.info,
        approved: exports.colors.success,
        rejected: exports.colors.error,
        needs_review: exports.colors.warning,
        corrected: exports.colors.highlight
    };
    const color = statusMap[status] || exports.colors.muted;
    console.log(color(`[${status.toUpperCase()}] ${message}`));
}
