import chalk from "chalk";
import { DataStore, defaultStore } from "../storage/store";

export interface InitOptions {
  dataDir?: string;
  force?: boolean;
}

export function runInit(options: InitOptions = {}): void {
  const store = options.dataDir ? new DataStore(options.dataDir) : defaultStore;

  console.log(chalk.cyan("========================================"));
  console.log(chalk.cyan("    合同里程碑回款 CLI 初始化"));
  console.log(chalk.cyan("========================================"));
  console.log("");

  if (store.exists() && !options.force) {
    console.log(chalk.yellow("⚠️  数据库已存在，使用 --force 参数可覆盖"));
    console.log(chalk.gray(`数据目录: ${store.getDataDir()}`));
    process.exit(1);
  }

  console.log(chalk.blue("📁 初始化数据目录..."));
  store.initialize();

  console.log(chalk.green("✅ 初始化完成！"));
  console.log("");
  console.log(chalk.gray("数据目录: ") + store.getDataDir());
  console.log(chalk.gray("数据库文件: database.json"));
  console.log("");
  console.log(chalk.cyan("下一步操作:"));
  console.log("  " + chalk.white("cmp import contract <文件>") + "  - 导入合同数据");
  console.log("  " + chalk.white("cmp import milestone <文件>") + " - 导入里程碑数据");
  console.log("  " + chalk.white("cmp demo") + "                    - 运行内置演示数据");
}
