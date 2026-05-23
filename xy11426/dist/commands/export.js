"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCommand = exportCommand;
const exportService_1 = require("../services/exportService");
const reportService_1 = require("../services/reportService");
const database_1 = require("../db/database");
const chalk_1 = __importDefault(require("chalk"));
async function exportCommand(batchId, options) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    const format = options.format || 'csv';
    const outputPath = options.output || `./exports/${batchId}.${format}`;
    try {
        if (options.failures) {
            const failuresPath = options.output || `./exports/${batchId}-failures.csv`;
            (0, exportService_1.exportFailuresToCSV)(batchId, failuresPath);
            console.log(chalk_1.default.green(`✓ 失败记录已导出: ${failuresPath}`));
            return 0;
        }
        if (options.audit) {
            const auditPath = options.output || `./exports/${batchId}-audit.csv`;
            (0, exportService_1.exportAuditLogs)(batchId, auditPath);
            console.log(chalk_1.default.green(`✓ 审计日志已导出: ${auditPath}`));
            return 0;
        }
        if (options.report) {
            const report = (0, reportService_1.generateReport)(batchId);
            const reportPath = options.output || `./exports/${batchId}-report.txt`;
            (0, exportService_1.exportReportToText)(report, reportPath);
            console.log(chalk_1.default.green(`✓ 报表已导出: ${reportPath}`));
            return 0;
        }
        if (format === 'csv') {
            (0, exportService_1.exportToCSV)(batchId, outputPath);
        }
        else if (format === 'excel' || format === 'xlsx') {
            (0, exportService_1.exportToExcel)(batchId, outputPath);
        }
        else {
            console.error(chalk_1.default.red(`错误: 不支持的导出格式: ${format}`));
            return 1;
        }
        console.log(chalk_1.default.green(`✓ 数据已导出: ${outputPath}`));
        return 0;
    }
    catch (error) {
        console.error(chalk_1.default.red('导出失败:'), error.message);
        return 1;
    }
}
