"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportCommand = reportCommand;
const reportService_1 = require("../services/reportService");
const database_1 = require("../db/database");
const chalk_1 = __importDefault(require("chalk"));
async function reportCommand(batchId) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    try {
        const report = (0, reportService_1.generateReport)(batchId);
        const text = (0, reportService_1.formatReportText)(report);
        console.log(text);
        if (report.invalidRecords > 0) {
            console.log(chalk_1.default.yellow(`注意: 存在 ${report.invalidRecords} 条问题记录，请处理后重新校验`));
            return 2;
        }
        return 0;
    }
    catch (error) {
        console.error(chalk_1.default.red('生成报表失败:'), error.message);
        return 1;
    }
}
