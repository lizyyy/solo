"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCheck = runCheck;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const store_1 = require("../storage/store");
const rules_1 = require("../engine/rules");
const SEVERITY_COLOR = {
    critical: chalk_1.default.red.bold,
    high: chalk_1.default.red,
    medium: chalk_1.default.yellow,
    low: chalk_1.default.cyan,
};
const SEVERITY_DISPLAY = {
    critical: "严重",
    high: "高",
    medium: "中",
    low: "低",
};
const TYPE_DISPLAY = {
    contract: "合同",
    milestone: "里程碑",
    deliveryProof: "交付证明",
    acceptanceForm: "验收单",
    invoice: "发票",
    paymentRecord: "收款流水",
};
function runCheck(options = {}) {
    const store = options.dataDir ? new store_1.DataStore(options.dataDir) : store_1.defaultStore;
    const engine = new rules_1.BusinessRulesEngine(store);
    if (!store.exists()) {
        console.log(chalk_1.default.red("❌ 数据库未初始化，请先运行 cmp init"));
        process.exit(1);
    }
    store.load();
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    数据一致性检查"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    console.log(chalk_1.default.blue("🔍 运行业务规则校验..."));
    const issues = engine.validateAll();
    console.log("");
    if (issues.length === 0) {
        console.log(chalk_1.default.green("✅ 所有数据检查通过，未发现问题！"));
        console.log("");
        const nextActions = engine.getNextActions();
        console.log(chalk_1.default.cyan("下一步跟进:"));
        for (const action of nextActions) {
            console.log(`  ${chalk_1.default.white(action)}`);
        }
        return;
    }
    const filteredIssues = options.milestone
        ? issues.filter((i) => {
            if (i.entityType === "milestone") {
                const milestone = store.getMilestoneById(i.entityId);
                return milestone?.milestoneNo === options.milestone;
            }
            if (i.entityType === "deliveryProof") {
                const proof = store.getDeliveryProofById(i.entityId);
                const milestone = proof ? store.getMilestoneById(proof.milestoneId) : undefined;
                return milestone?.milestoneNo === options.milestone;
            }
            if (i.entityType === "acceptanceForm") {
                const form = store.getAcceptanceFormById(i.entityId);
                const milestone = form ? store.getMilestoneById(form.milestoneId) : undefined;
                return milestone?.milestoneNo === options.milestone;
            }
            if (i.entityType === "invoice") {
                const invoice = store.getInvoiceById(i.entityId);
                const milestone = invoice ? store.getMilestoneById(invoice.milestoneId) : undefined;
                return milestone?.milestoneNo === options.milestone;
            }
            if (i.entityType === "paymentRecord") {
                const payment = store.getPaymentRecordById(i.entityId);
                const milestone = payment?.milestoneId ? store.getMilestoneById(payment.milestoneId) : undefined;
                return milestone?.milestoneNo === options.milestone;
            }
            return false;
        })
        : issues;
    if (filteredIssues.length === 0) {
        console.log(chalk_1.default.green("✅ 未发现相关问题！"));
        return;
    }
    const summary = {
        critical: filteredIssues.filter((i) => i.severity === "critical").length,
        high: filteredIssues.filter((i) => i.severity === "high").length,
        medium: filteredIssues.filter((i) => i.severity === "medium").length,
        low: filteredIssues.filter((i) => i.severity === "low").length,
    };
    console.log(chalk_1.default.yellow(`⚠️  发现 ${filteredIssues.length} 个问题`));
    console.log("");
    console.log(chalk_1.default.red(`严重: ${summary.critical}`) +
        "  " +
        chalk_1.default.redBright(`高: ${summary.high}`) +
        "  " +
        chalk_1.default.yellow(`中: ${summary.medium}`) +
        "  " +
        chalk_1.default.cyan(`低: ${summary.low}`));
    console.log("");
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.white("级别"),
            chalk_1.default.white("类型"),
            chalk_1.default.white("代码"),
            chalk_1.default.white("问题描述"),
            chalk_1.default.white("建议"),
        ],
        colWidths: [10, 12, 10, 45, 30],
        wordWrap: true,
    });
    const sortedIssues = [...filteredIssues].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
    });
    for (const issue of sortedIssues) {
        const color = SEVERITY_COLOR[issue.severity] || chalk_1.default.white;
        table.push([
            color(SEVERITY_DISPLAY[issue.severity]),
            TYPE_DISPLAY[issue.entityType] || issue.entityType,
            issue.code,
            issue.message,
            issue.suggestion || "-",
        ]);
    }
    console.log(table.toString());
    console.log("");
    const nextActions = engine.getNextActions();
    console.log(chalk_1.default.cyan("下一步跟进:"));
    for (const action of nextActions) {
        console.log(`  ${chalk_1.default.white(action)}`);
    }
}
//# sourceMappingURL=check.js.map