"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runImport = runImport;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const store_1 = require("../storage/store");
const importer_1 = require("../utils/importer");
const rules_1 = require("../engine/rules");
const TYPE_DISPLAY = {
    contract: "合同",
    milestone: "里程碑",
    delivery: "交付证明",
    acceptance: "验收单",
    invoice: "发票",
    payment: "收款流水",
};
function runImport(type, filePath, options = {}) {
    const store = options.dataDir ? new store_1.DataStore(options.dataDir) : store_1.defaultStore;
    const engine = new rules_1.BusinessRulesEngine(store);
    const importer = new importer_1.DataImporter(store, engine);
    const operator = options.operator || "system";
    if (!store.exists()) {
        console.log(chalk_1.default.red("❌ 数据库未初始化，请先运行 cmp init"));
        process.exit(1);
    }
    store.load();
    console.log(chalk_1.default.cyan("========================================"));
    console.log(chalk_1.default.cyan(`    导入 ${TYPE_DISPLAY[type]} 数据`));
    console.log(chalk_1.default.cyan("========================================"));
    console.log("");
    console.log(chalk_1.default.gray(`文件: ${filePath}`));
    console.log(chalk_1.default.gray(`操作者: ${operator}`));
    console.log("");
    try {
        const result = importer.importFromJSONFile(filePath, type, operator);
        const table = new cli_table3_1.default({
            head: [
                chalk_1.default.white("类型"),
                chalk_1.default.white("编号"),
                chalk_1.default.white("状态"),
                chalk_1.default.white("原因"),
            ],
            colWidths: [12, 20, 12, 40],
        });
        for (const detail of result.details) {
            let statusColor = chalk_1.default.green;
            if (detail.action === "skipped")
                statusColor = chalk_1.default.yellow;
            if (detail.action === "error")
                statusColor = chalk_1.default.red;
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
            console.log(chalk_1.default.green(`✅ 导入成功！新增: ${result.imported}, 跳过: ${result.skipped}`));
        }
        else {
            console.log(chalk_1.default.red(`❌ 导入失败！新增: ${result.imported}, 跳过: ${result.skipped}, 错误: ${result.errors.length}`));
            console.log("");
            console.log(chalk_1.default.red("错误详情:"));
            for (const error of result.errors) {
                console.log(chalk_1.default.red(`  - ${error}`));
            }
        }
        console.log("");
        console.log(chalk_1.default.cyan("状态变化:"));
        console.log(chalk_1.default.gray("  里程碑状态已根据数据自动更新"));
        console.log("");
        console.log(chalk_1.default.cyan("下一步操作:"));
        console.log("  " + chalk_1.default.white("cmp check") + "        - 检查数据一致性");
        console.log("  " + chalk_1.default.white("cmp report") + "       - 查看汇总报告");
    }
    catch (error) {
        console.log(chalk_1.default.red(`❌ 导入失败: ${error.message}`));
        process.exit(1);
    }
}
//# sourceMappingURL=import.js.map