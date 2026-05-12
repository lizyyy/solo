import chalk from "chalk";
import Table from "cli-table3";
import { DataStore, defaultStore } from "../storage/store";
import { BusinessRulesEngine, defaultEngine } from "../engine/rules";
import { MilestoneStatus } from "../models/types";

export interface ReportOptions {
  dataDir?: string;
  format?: "table" | "json";
}

const STATUS_COLOR: Record<MilestoneStatus, chalk.Chalk> = {
  not_started: chalk.gray,
  delivered: chalk.blue,
  accepted: chalk.cyan,
  invoiced: chalk.magenta,
  paid: chalk.green,
  partially_paid: chalk.yellow,
  overdue: chalk.red,
};

const STATUS_DISPLAY: Record<MilestoneStatus, string> = {
  not_started: "未开始",
  delivered: "已交付",
  accepted: "已验收",
  invoiced: "已开票",
  paid: "已回款",
  partially_paid: "部分回款",
  overdue: "已超期",
};

export function runReport(options: ReportOptions = {}): void {
  const store = options.dataDir ? new DataStore(options.dataDir) : defaultStore;
  const engine = new BusinessRulesEngine(store);

  if (!store.exists()) {
    console.log(chalk.red("❌ 数据库未初始化，请先运行 cmp init"));
    process.exit(1);
  }

  store.load();
  engine.validateAll();

  const summary = engine.calculateDashboardSummary();
  const contracts = store.getAllContracts();
  const milestones = store.getAllMilestones();

  if (options.format === "json") {
    console.log(
      JSON.stringify(
        {
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
        },
        null,
        2
      )
    );
    return;
  }

  console.log(chalk.cyan("========================================"));
  console.log(chalk.cyan("    合同回款汇总报告"));
  console.log(chalk.cyan("========================================"));
  console.log("");
  console.log(chalk.gray(`生成时间: ${new Date().toLocaleString()}`));
  console.log("");

  console.log(chalk.bold("📊 全局汇总"));
  const dashboardTable = new Table({
    head: [
      chalk.white("指标"),
      chalk.white("数值"),
    ],
    colWidths: [25, 30],
  });

  dashboardTable.push(["合同总数", summary.totalContracts + " 个"]);
  dashboardTable.push(["合同总金额", chalk.green("¥" + summary.totalAmount.toLocaleString())]);
  dashboardTable.push(["已交付金额", chalk.blue("¥" + summary.totalDelivered.toLocaleString())]);
  dashboardTable.push(["已验收金额", chalk.cyan("¥" + summary.totalAccepted.toLocaleString())]);
  dashboardTable.push(["已开票金额", chalk.magenta("¥" + summary.totalInvoiced.toLocaleString())]);
  dashboardTable.push(["已回款金额", chalk.green("¥" + summary.totalPaid.toLocaleString())]);
  dashboardTable.push([chalk.yellow("待回款金额"), chalk.yellow("¥" + (summary.totalAmount - summary.totalPaid).toLocaleString())]);
  dashboardTable.push([chalk.red("超期未收"), chalk.red(summary.overdueCount + " 个里程碑, ¥" + summary.overdueAmount.toLocaleString())]);
  dashboardTable.push(["未匹配收款", summary.unmatchedPayments + " 笔"]);

  if (summary.issues.critical > 0 || summary.issues.high > 0) {
    dashboardTable.push([
      chalk.red("问题数量"),
      chalk.red(`严重: ${summary.issues.critical}, 高: ${summary.issues.high}, 中: ${summary.issues.medium}`),
    ]);
  }

  console.log(dashboardTable.toString());
  console.log("");

  console.log(chalk.bold("📋 合同明细"));
  const contractTable = new Table({
    head: [
      chalk.white("合同编号"),
      chalk.white("合同名称"),
      chalk.white("客户"),
      chalk.white("总金额"),
      chalk.white("已开票"),
      chalk.white("已回款"),
      chalk.white("待回款"),
      chalk.white("完成度"),
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
      chalk.green("¥" + paid.toLocaleString()),
      chalk.yellow("¥" + (contract.totalAmount - paid).toLocaleString()),
      progress + "%",
    ]);
  }

  console.log(contractTable.toString());
  console.log("");

  console.log(chalk.bold("🎯 里程碑状态分布"));
  const statusCounts: Record<MilestoneStatus, number> = {
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

  const statusTable = new Table({
    head: [
      chalk.white("状态"),
      chalk.white("数量"),
      chalk.white("占比"),
    ],
    colWidths: [15, 10, 15],
  });

  for (const [status, count] of Object.entries(statusCounts)) {
    if (count > 0) {
      const s = status as MilestoneStatus;
      statusTable.push([
        STATUS_COLOR[s](STATUS_DISPLAY[s]),
        count + " 个",
        ((count / milestones.length) * 100).toFixed(1) + "%",
      ]);
    }
  }

  console.log(statusTable.toString());
  console.log("");

  console.log(chalk.bold("📌 下一步跟进动作"));
  const nextActions = engine.getNextActions();
  for (const action of nextActions) {
    console.log(`  ${chalk.white(action)}`);
  }
}
