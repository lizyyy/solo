#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const init_1 = require("./commands/init");
const import_1 = require("./commands/import");
const check_1 = require("./commands/check");
const detail_1 = require("./commands/detail");
const report_1 = require("./commands/report");
const run_demo_1 = require("./scripts/run-demo");
const program = new commander_1.Command();
program
    .name("cmp")
    .description("合同里程碑回款 CLI 工具")
    .version("1.0.0");
program
    .command("init")
    .description("初始化数据库")
    .option("-d, --data-dir <dir>", "数据目录", ".cmp-data")
    .option("-f, --force", "强制覆盖已存在的数据库")
    .action((options) => {
    (0, init_1.runInit)(options);
});
const importCmd = program
    .command("import")
    .description("导入数据")
    .option("-d, --data-dir <dir>", "数据目录", ".cmp-data")
    .option("-o, --operator <name>", "操作者", "system");
importCmd
    .command("contract <file>")
    .description("导入合同数据")
    .action((file, options) => {
    (0, import_1.runImport)("contract", file, {
        dataDir: options.parent?.dataDir,
        operator: options.parent?.operator,
    });
});
importCmd
    .command("milestone <file>")
    .description("导入里程碑数据")
    .action((file, options) => {
    (0, import_1.runImport)("milestone", file, {
        dataDir: options.parent?.dataDir,
        operator: options.parent?.operator,
    });
});
importCmd
    .command("delivery <file>")
    .description("导入交付证明数据")
    .action((file, options) => {
    (0, import_1.runImport)("delivery", file, {
        dataDir: options.parent?.dataDir,
        operator: options.parent?.operator,
    });
});
importCmd
    .command("acceptance <file>")
    .description("导入验收单数据")
    .action((file, options) => {
    (0, import_1.runImport)("acceptance", file, {
        dataDir: options.parent?.dataDir,
        operator: options.parent?.operator,
    });
});
importCmd
    .command("invoice <file>")
    .description("导入发票数据")
    .action((file, options) => {
    (0, import_1.runImport)("invoice", file, {
        dataDir: options.parent?.dataDir,
        operator: options.parent?.operator,
    });
});
importCmd
    .command("payment <file>")
    .description("导入收款流水数据")
    .action((file, options) => {
    (0, import_1.runImport)("payment", file, {
        dataDir: options.parent?.dataDir,
        operator: options.parent?.operator,
    });
});
program
    .command("check")
    .description("检查数据一致性")
    .option("-d, --data-dir <dir>", "数据目录", ".cmp-data")
    .option("-m, --milestone <no>", "指定里程碑编号")
    .action((options) => {
    (0, check_1.runCheck)(options);
});
program
    .command("detail <contractNo>")
    .description("查看合同详情")
    .option("-d, --data-dir <dir>", "数据目录", ".cmp-data")
    .option("--history", "显示历史记录")
    .option("--issues", "显示问题")
    .action((contractNo, options) => {
    (0, detail_1.runDetail)(contractNo, {
        dataDir: options.dataDir,
        showHistory: options.history,
        showIssues: options.issues,
    });
});
program
    .command("report")
    .description("生成汇总报告")
    .option("-d, --data-dir <dir>", "数据目录", ".cmp-data")
    .option("-f, --format <format>", "输出格式: table|json", "table")
    .action((options) => {
    (0, report_1.runReport)(options);
});
program
    .command("demo")
    .description("运行内置演示数据")
    .option("-d, --data-dir <dir>", "数据目录", ".cmp-data")
    .option("-f, --force", "强制覆盖已存在的数据库")
    .action((options) => {
    (0, run_demo_1.runDemo)(options);
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map