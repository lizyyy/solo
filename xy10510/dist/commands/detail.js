"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDetail = runDetail;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const store_1 = require("../storage/store");
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
const OPERATION_DISPLAY = {
    create: "创建",
    update: "更新",
    delete: "删除",
    match: "匹配",
    unmatch: "取消匹配",
    import: "导入",
    correct: "人工修正",
};
function runDetail(contractNo, options = {}) {
    const store = options.dataDir ? new store_1.DataStore(options.dataDir) : store_1.defaultStore;
    if (!store.exists()) {
        console.log(chalk_1.default.red("❌ 数据库未初始化，请先运行 cmp init"));
        process.exit(1);
    }
    store.load();
    const contract = store.getContractByNo(contractNo);
    if (!contract) {
        console.log(chalk_1.default.red(`❌ 未找到合同: ${contractNo}`));
        process.exit(1);
    }
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    合同详情"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    console.log(chalk_1.default.bold("📋 合同基本信息"));
    console.log(`  ${chalk_1.default.gray("合同编号:")} ${contract.contractNo}`);
    console.log(`  ${chalk_1.default.gray("合同名称:")} ${contract.name}`);
    console.log(`  ${chalk_1.default.gray("客户:")} ${contract.client}`);
    console.log(`  ${chalk_1.default.gray("开始日期:")} ${contract.startDate}`);
    console.log(`  ${chalk_1.default.gray("结束日期:")} ${contract.endDate}`);
    console.log(`  ${chalk_1.default.gray("合同金额:")} ¥${contract.totalAmount.toLocaleString()}`);
    console.log(`  ${chalk_1.default.gray("状态:")} ${contract.status}`);
    console.log("");
    const milestones = store.getMilestonesByContractId(contract.id);
    console.log(chalk_1.default.bold("📊 里程碑明细"));
    console.log("");
    for (const milestone of milestones) {
        console.log(chalk_1.default.bold(`  里程碑 ${milestone.milestoneNo}: ${milestone.name}`));
        console.log(`    ${chalk_1.default.gray("金额:")} ¥${milestone.amount.toLocaleString()}`);
        console.log(`    ${chalk_1.default.gray("预计交付:")} ${milestone.expectedDeliveryDate}`);
        console.log(`    ${chalk_1.default.gray("状态:")} ${STATUS_COLOR[milestone.status](STATUS_DISPLAY[milestone.status])}`);
        const deliveryProofs = store.getDeliveryProofsByMilestoneId(milestone.id);
        const acceptanceForms = store.getAcceptanceFormsByMilestoneId(milestone.id);
        const invoices = store.getInvoicesByMilestoneId(milestone.id);
        const payments = store.getPaymentRecordsByMilestoneId(milestone.id);
        const approvedDelivery = deliveryProofs.find((p) => p.status === "approved");
        const signedAcceptance = acceptanceForms.find((f) => f.status === "signed");
        const issuedInvoices = invoices.filter((i) => i.status === "issued" || i.status === "received");
        const matchedPayments = payments.filter((p) => p.status === "matched" || p.status === "partially_matched");
        const totalInvoiced = issuedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const totalPaid = matchedPayments.reduce((sum, p) => sum + p.amount, 0);
        console.log(`    ${chalk_1.default.gray("已交付:")} ${approvedDelivery ? chalk_1.default.green("✅ " + approvedDelivery.proofNo) : chalk_1.default.red("❌ 无")}`);
        console.log(`    ${chalk_1.default.gray("已验收:")} ${signedAcceptance ? chalk_1.default.green("✅ " + signedAcceptance.formNo + " (¥" + signedAcceptance.acceptedAmount.toLocaleString() + ")") : chalk_1.default.red("❌ 无")}`);
        console.log(`    ${chalk_1.default.gray("已开票:")} ${issuedInvoices.length > 0 ? chalk_1.default.magenta("¥" + totalInvoiced.toLocaleString() + " (" + issuedInvoices.length + "张)") : chalk_1.default.gray("¥0")}`);
        console.log(`    ${chalk_1.default.gray("已回款:")} ${totalPaid > 0 ? chalk_1.default.green("¥" + totalPaid.toLocaleString()) : chalk_1.default.gray("¥0")}`);
        console.log(`    ${chalk_1.default.gray("待回款:")} ${chalk_1.default.yellow("¥" + Math.max(0, milestone.amount - totalPaid).toLocaleString())}`);
        if (options.showIssues) {
            const issues = store.getIssuesByEntity("milestone", milestone.id);
            if (issues.length > 0) {
                console.log(`    ${chalk_1.default.yellow("⚠️  问题:")}`);
                for (const issue of issues) {
                    console.log(`      - ${issue.message}`);
                }
            }
        }
        if (options.showHistory) {
            const operations = store.getOperationsByEntity("milestone", milestone.id);
            if (operations.length > 0) {
                console.log(`    ${chalk_1.default.cyan("📜 历史记录:")}`);
                for (const op of operations.slice(0, 5)) {
                    const statusColor = op.success ? chalk_1.default.green : chalk_1.default.red;
                    console.log(`      [${op.timestamp}] ${chalk_1.default.gray(op.operator)} ${OPERATION_DISPLAY[op.operation]} - ${statusColor(op.success ? "成功" : "失败")}`);
                    if (!op.success && op.failureReason) {
                        console.log(`        原因: ${op.failureReason}`);
                    }
                    if (op.before && op.after) {
                        console.log(`        前后差异: 已记录`);
                    }
                }
            }
        }
        console.log("");
    }
    const contractTotal = milestones.reduce((sum, m) => sum + m.amount, 0);
    const contractInvoiced = milestones.reduce((sum, m) => {
        const invoices = store.getInvoicesByMilestoneId(m.id);
        return sum + invoices.filter((i) => i.status === "issued" || i.status === "received").reduce((s, inv) => s + inv.amount, 0);
    }, 0);
    const contractPaid = milestones.reduce((sum, m) => {
        const payments = store.getPaymentRecordsByMilestoneId(m.id);
        return sum + payments.filter((p) => p.status === "matched" || p.status === "partially_matched").reduce((s, p) => s + p.amount, 0);
    }, 0);
    console.log(chalk_1.default.bold("📈 合同汇总"));
    const summaryTable = new cli_table3_1.default({
        head: [
            chalk_1.default.white("指标"),
            chalk_1.default.white("金额"),
            chalk_1.default.white("比例"),
        ],
        colWidths: [15, 20, 15],
    });
    summaryTable.push(["合同总额", "¥" + contract.totalAmount.toLocaleString(), "100%"]);
    summaryTable.push(["已开票", "¥" + contractInvoiced.toLocaleString(), ((contractInvoiced / contract.totalAmount) * 100).toFixed(1) + "%"]);
    summaryTable.push(["已回款", "¥" + contractPaid.toLocaleString(), ((contractPaid / contract.totalAmount) * 100).toFixed(1) + "%"]);
    summaryTable.push([chalk_1.default.yellow("待回款"), chalk_1.default.yellow("¥" + (contract.totalAmount - contractPaid).toLocaleString()), chalk_1.default.yellow(((1 - contractPaid / contract.totalAmount) * 100).toFixed(1) + "%")]);
    console.log(summaryTable.toString());
}
//# sourceMappingURL=detail.js.map