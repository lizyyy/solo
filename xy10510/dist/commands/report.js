"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReport = runReport;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const store_1 = require("../storage/store");
const rules_1 = require("../engine/rules");
const STATUS_COLOR = {
    not_started: chalk_1.default.gray,
    delivered: chalk_1.default.blue,
    accepted: chalk_1.default.cyan,
    invoiced: chalk_1.default.magenta,
    paid: chalk_1.default.green,
    partially_paid: chalk_1.default.yellow,
    overdue: chalk_1.default.red,
};
const STATUS_DISPLAY = {
    not_started: "未开始",
    delivered: "已交付",
    accepted: "已验收",
    invoiced: "已开票",
    paid: "已回款",
    partially_paid: "部分回款",
    overdue: "已超期",
};
function runReport(options = {}) {
    const store = options.dataDir ? new store_1.DataStore(options.dataDir) : store_1.defaultStore;
    const engine = new rules_1.BusinessRulesEngine(store);
    if (!store.exists()) {
        console.log(chalk_1.default.red("❌ 数据库未初始化，请先运行 cmp init"));
        process.exit(1);
    }
    store.load();
    engine.validateAll();
    const summary = engine.calculateDashboardSummary();
    const contracts = store.getAllContracts();
    const milestones = store.getAllMilestones();
    if (options.format === "json") {
        console.log(JSON.stringify({
            summary,
            contracts: contracts.map((c) => {
                const ms = store.getMilestonesByContractId(c.id);
                const invoiced = ms.reduce((sum, m) => {
                    const invoices = store.getInvoicesByMilestoneId(m.id);
                    return sum + invoices.filter((i) => i.status === "issued" || i.status === "received").reduce((s, inv) => s + inv.amount, 0);
                }, 0);
                const paid = ms.reduce((sum, m) => {
                    const payments = store.getPaymentRecordsByMilestoneId(m.id);
                    return sum + payments.filter((p) => p.status === "matched" || p.status === "partially_matched").reduce((s, p) => s + p.amount, 0);
                }, 0);
                return {
                    contractNo: c.contractNo,
                    name: c.name,
                    client: c.client,
                    totalAmount: c.totalAmount,
                    invoiced,
                    paid,
                    unpaid: c.totalAmount - paid,
                };
            }),
            nextActions: engine.getNextActions(),
        }, null, 2));
        return;
    }
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    合同回款汇总报告"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    console.log(chalk_1.default.gray(`生成时间: ${new Date().toLocaleString()}`));
    console.log("");
    console.log(chalk_1.default.bold("📊 全局汇总"));
    const dashboardTable = new cli_table3_1.default({
        head: [
            chalk_1.default.white("指标"),
            chalk_1.default.white("数值"),
        ],
        colWidths: [25, 30],
    });
    dashboardTable.push(["合同总数", summary.totalContracts + " 个"]);
    dashboardTable.push(["合同总金额", chalk_1.default.green("¥" + summary.totalAmount.toLocaleString())]);
    dashboardTable.push(["已交付金额", chalk_1.default.blue("¥" + summary.totalDelivered.toLocaleString())]);
    dashboardTable.push(["已验收金额", chalk_1.default.cyan("¥" + summary.totalAccepted.toLocaleString())]);
    dashboardTable.push(["已开票金额", chalk_1.default.magenta("¥" + summary.totalInvoiced.toLocaleString())]);
    dashboardTable.push(["已回款金额", chalk_1.default.green("¥" + summary.totalPaid.toLocaleString())]);
    dashboardTable.push([chalk_1.default.yellow("待回款金额"), chalk_1.default.yellow("¥" + (summary.totalAmount - summary.totalPaid).toLocaleString())]);
    dashboardTable.push([chalk_1.default.red("超期未收"), chalk_1.default.red(summary.overdueCount + " 个里程碑, ¥" + summary.overdueAmount.toLocaleString())]);
    dashboardTable.push(["未匹配收款", summary.unmatchedPayments + " 笔"]);
    if (summary.issues.critical > 0 || summary.issues.high > 0) {
        dashboardTable.push([
            chalk_1.default.red("问题数量"),
            chalk_1.default.red(`严重: ${summary.issues.critical}, 高: ${summary.issues.high}, 中: ${summary.issues.medium}`),
        ]);
    }
    console.log(dashboardTable.toString());
    console.log("");
    console.log(chalk_1.default.bold("📋 合同明细"));
    const contractTable = new cli_table3_1.default({
        head: [
            chalk_1.default.white("合同编号"),
            chalk_1.default.white("合同名称"),
            chalk_1.default.white("客户"),
            chalk_1.default.white("总金额"),
            chalk_1.default.white("已开票"),
            chalk_1.default.white("已回款"),
            chalk_1.default.white("待回款"),
            chalk_1.default.white("完成度"),
        ],
        colWidths: [15, 25, 15, 15, 15, 15, 15, 12],
    });
    for (const contract of contracts) {
        const ms = store.getMilestonesByContractId(contract.id);
        const invoiced = ms.reduce((sum, m) => {
            const invoices = store.getInvoicesByMilestoneId(m.id);
            return sum + invoices.filter((i) => i.status === "issued" || i.status === "received").reduce((s, inv) => s + inv.amount, 0);
        }, 0);
        const paid = ms.reduce((sum, m) => {
            const payments = store.getPaymentRecordsByMilestoneId(m.id);
            return sum + payments.filter((p) => p.status === "matched" || p.status === "partially_matched").reduce((s, p) => s + p.amount, 0);
        }, 0);
        const progress = ((paid / contract.totalAmount) * 100).toFixed(1);
        contractTable.push([
            contract.contractNo,
            contract.name,
            contract.client,
            "¥" + contract.totalAmount.toLocaleString(),
            "¥" + invoiced.toLocaleString(),
            chalk_1.default.green("¥" + paid.toLocaleString()),
            chalk_1.default.yellow("¥" + (contract.totalAmount - paid).toLocaleString()),
            progress + "%",
        ]);
    }
    console.log(contractTable.toString());
    console.log("");
    console.log(chalk_1.default.bold("🎯 里程碑状态分布"));
    const statusCounts = {
        not_started: 0,
        delivered: 0,
        accepted: 0,
        invoiced: 0,
        paid: 0,
        partially_paid: 0,
        overdue: 0,
    };
    for (const m of milestones) {
        statusCounts[m.status]++;
    }
    const statusTable = new cli_table3_1.default({
        head: [
            chalk_1.default.white("状态"),
            chalk_1.default.white("数量"),
            chalk_1.default.white("占比"),
        ],
        colWidths: [15, 10, 15],
    });
    for (const [status, count] of Object.entries(statusCounts)) {
        if (count > 0) {
            const s = status;
            statusTable.push([
                STATUS_COLOR[s](STATUS_DISPLAY[s]),
                count + " 个",
                ((count / milestones.length) * 100).toFixed(1) + "%",
            ]);
        }
    }
    console.log(statusTable.toString());
    console.log("");
    console.log(chalk_1.default.bold("📌 下一步跟进动作"));
    const nextActions = engine.getNextActions();
    for (const action of nextActions) {
        console.log(`  ${chalk_1.default.white(action)}`);
    }
}
//# sourceMappingURL=report.js.map