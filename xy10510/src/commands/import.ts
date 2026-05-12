import chalk from "chalk";
import Table from "cli-table3";
import { DataStore, defaultStore } from "../storage/store";
import { DataImporter, ImportType, defaultImporter } from "../utils/importer";
import { BusinessRulesEngine, defaultEngine } from "../engine/rules";

export interface ImportOptions {
  dataDir?: string;
  operator?: string;
}

const TYPE_DISPLAY: Record<ImportType, string> = {
  contract: "合同",
  milestone: "里程碑",
  delivery: "交付证明",
  acceptance: "验收单",
  invoice: "发票",
  payment: "收款流水",
};

export function runImport(type: ImportType, filePath: string, options: ImportOptions = {}): void {
  const store = options.dataDir ? new DataStore(options.dataDir) : defaultStore;
  const engine = new BusinessRulesEngine(store);
  const importer = new DataImporter(store, engine);
  const operator = options.operator || "system";

  if (!store.exists()) {
    console.log(chalk.red("❌ 数据库未初始化，请先运行 cmp init"));
    process.exit(1);
  }

  store.load();

  console.log(chalk.cyan("========================================"));
  console.log(chalk.cyan(`    导入 ${TYPE_DISPLAY[type]} 数据`));
  console.log(chalk.cyan("========================================"));
  console.log("");
  console.log(chalk.gray(`文件: ${filePath}`));
  console.log(chalk.gray(`操作者: ${operator}`));
  console.log("");

  try {
    const result = importer.importFromJSONFile(filePath, type, operator);

    const table = new Table({
      head: [
        chalk.white("类型"),
        chalk.white("编号"),
        chalk.white("状态"),
        chalk.white("原因"),
      ],
      colWidths: [12, 20, 12, 40],
    });

    for (const detail of result.details) {
      let statusColor = chalk.green;
      if (detail.action === "skipped") statusColor = chalk.yellow;
      if (detail.action === "error") statusColor = chalk.red;

      table.push([
        TYPE_DISPLAY[detail.type],
        detail.no,
        statusColor(detail.action === "created" ? "新增" : detail.action === "skipped" ? "跳过" : "错误"),
        detail.reason || "-",
      ]);
    }

    console.log(table.toString());
    console.log("");

    if (result.success) {
      console.log(chalk.green(`✅ 导入成功！新增: ${result.imported}, 跳过: ${result.skipped}`));
    } else {
      console.log(chalk.red(`❌ 导入失败！新增: ${result.imported}, 跳过: ${result.skipped}, 错误: ${result.errors.length}`));
      console.log("");
      console.log(chalk.red("错误详情:"));
      for (const error of result.errors) {
        console.log(chalk.red(`  - ${error}`));
      }
    }

    console.log("");
    console.log(chalk.cyan("状态变化:"));
    console.log(chalk.gray("  里程碑状态已根据数据自动更新"));
    console.log("");
    console.log(chalk.cyan("下一步操作:"));
    console.log("  " + chalk.white("cmp check") + "        - 检查数据一致性");
    console.log("  " + chalk.white("cmp report") + "       - 查看汇总报告");
  } catch (error) {
    console.log(chalk.red(`❌ 导入失败: ${(error as Error).message}`));
    process.exit(1);
  }
}
