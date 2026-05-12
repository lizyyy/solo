"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInit = runInit;
const chalk_1 = __importDefault(require("chalk"));
const store_1 = require("../storage/store");
function runInit(options = {}) {
    const store = options.dataDir ? new store_1.DataStore(options.dataDir) : store_1.defaultStore;
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan("    合同里程碑回款 CLI 初始化"));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    if (store.exists() && !options.force) {
        console.log(chalk_1.default.yellow("⚠️  数据库已存在，使用 --force 参数可覆盖"));
        console.log(chalk_1.default.gray(`数据目录: ${store.getDataDir()}`));
        process.exit(1);
    }
    console.log(chalk_1.default.blue("📁 初始化数据目录..."));
    store.initialize();
    console.log(chalk_1.default.green("✅ 初始化完成！"));
    console.log("");
    console.log(chalk_1.default.gray("数据目录: ") + store.getDataDir());
    console.log(chalk_1.default.gray("数据库文件: database.json"));
    console.log("");
    console.log(chalk_1.default.cyan("下一步操作:"));
    console.log("  " + chalk_1.default.white("cmp import contract <文件>") + "  - 导入合同数据");
    console.log("  " + chalk_1.default.white("cmp import milestone <文件>") + " - 导入里程碑数据");
    console.log("  " + chalk_1.default.white("cmp demo") + "                    - 运行内置演示数据");
}
//# sourceMappingURL=init.js.map