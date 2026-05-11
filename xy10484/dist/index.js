#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const import_1 = require("./commands/import");
const list_1 = require("./commands/list");
const detail_1 = require("./commands/detail");
const review_1 = require("./commands/review");
const report_1 = require("./commands/report");
const stats_1 = require("./commands/stats");
const reset_1 = require("./commands/reset");
const program = new commander_1.Command();
program
    .name('logistics-abnormal')
    .description('物流签收异常 CLI - 帮助客服处理物流签收异常问题')
    .version('1.0.0');
(0, import_1.registerImportCommand)(program);
(0, list_1.registerListCommand)(program);
(0, detail_1.registerDetailCommand)(program);
(0, review_1.registerReviewCommand)(program);
(0, report_1.registerReportCommand)(program);
(0, stats_1.registerStatsCommand)(program);
(0, reset_1.registerResetCommand)(program);
program.parse(process.argv);
