import chalk from "chalk";
import Table from "cli-table3";
import { DataStore, defaultStore } from "../storage/store";
import { BusinessRulesEngine, defaultEngine } from "../engine/rules";

export interface CheckOptions {
  dataDir?: string;
  milestone?: string;
}

const SEVERITY_COLOR: Record<string, chalk.Chalk> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.cyan,
};

const SEVERITY_DISPLAY: Record<string, string> = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
};

const TYPE_DISPLAY: Record<string, string> = {
  contract: "合同",
  milestone: "里程碑",
  deliveryProof: "交付证明",
  acceptanceForm: "验收单",
  invoice: "发票",
  paymentRecord: "收款流水",
};

export function runCheck(options: CheckOptions = {}): void {
  const store = options.dataDir ? new DataStore(options.dataDir) : defaultStore;
  const engine = new BusinessRulesEngine(store);

  if (!store.exists()) {
    console.log(chalk.red("❌ 数据库未初始化，请先运行 cmp init"));
    process.exit(1);
  }

  store.load();

  console.log(chalk.cyan("========================================"));
  console.log(chalk.cyan("    数据一致性检查"));
  console.log(chalk.cyan("========================================"));
  console.log("");

  console.log(chalk.blue("🔍 运行业务规则校验..."));
  const issues = engine.validateAll();
  console.log("");

  if (issues.length === 0) {
    console.log(chalk.green("✅ 所有数据检查通过，未发现问题！"));
    console.log("");
    const nextActions = engine.getNextActions();
    console.log(chalk.cyan("下一步跟进:"));
    for (const action of nextActions) {
      console.log(`  ${chalk.white(action)}`);
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
    console.log(chalk.green("✅ 未发现相关问题！"));
    return;
  }

  const summary = {
    critical: filteredIssues.filter((i) => i.severity === "critical").length,
    high: filteredIssues.filter((i) => i.severity === "high").length,
    medium: filteredIssues.filter((i) => i.severity === "medium").length,
    low: filteredIssues.filter((i) => i.severity === "low").length,
  };

  console.log(chalk.yellow(`⚠️  发现 ${filteredIssues.length} 个问题`));
  console.log("");
  console.log(
    chalk.red(`严重: ${summary.critical}`) +
      "  " +
      chalk.redBright(`高: ${summary.high}`) +
      "  " +
      chalk.yellow(`中: ${summary.medium}`) +
      "  " +
      chalk.cyan(`低: ${summary.low}`)
  );
  console.log("");

  const table = new Table({
    head: [
      chalk.white("级别"),
      chalk.white("类型"),
      chalk.white("代码"),
      chalk.white("问题描述"),
      chalk.white("建议"),
    ],
    colWidths: [10, 12, 10, 45, 30],
    wordWrap: true,
  });

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  for (const issue of sortedIssues) {
    const color = SEVERITY_COLOR[issue.severity] || chalk.white;
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
  console.log(chalk.cyan("下一步跟进:"));
  for (const action of nextActions) {
    console.log(`  ${chalk.white(action)}`);
  }
}
