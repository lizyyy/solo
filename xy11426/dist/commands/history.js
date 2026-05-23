"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyCommand = historyCommand;
const auditService_1 = require("../services/auditService");
const database_1 = require("../db/database");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
async function historyCommand(options) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    const limit = options.limit || 100;
    try {
        let logs = [];
        if (options.batch) {
            logs = (0, auditService_1.getAuditLogsByBatch)(options.batch, limit);
        }
        else if (options.record) {
            logs = (0, auditService_1.getRecordChangeHistory)(options.record);
        }
        else if (options.operator) {
            logs = (0, auditService_1.getAuditLogsByOperator)(options.operator, limit);
        }
        else {
            logs = (0, auditService_1.getAllAuditLogs)(limit);
        }
        if (logs.length === 0) {
            console.log(chalk_1.default.yellow('暂无操作记录'));
            return 0;
        }
        console.log(chalk_1.default.cyan(`操作记录 (共 ${logs.length} 条):`));
        console.log('');
        const table = new cli_table3_1.default({
            head: ['时间', '操作员', '操作', '详情'],
            colWidths: [20, 12, 15, 80]
        });
        for (const log of logs) {
            let detail = '';
            if (log.old_value && log.new_value) {
                detail = `${log.old_value} → ${log.new_value}`;
            }
            else if (log.new_value) {
                detail = `新增: ${log.new_value}`;
            }
            else if (log.old_value) {
                detail = `删除: ${log.old_value}`;
            }
            table.push([
                log.created_at,
                log.operator,
                log.action,
                detail.substring(0, 75)
            ]);
        }
        console.log(table.toString());
        return 0;
    }
    catch (error) {
        console.error(chalk_1.default.red('查询历史失败:'), error.message);
        return 1;
    }
}
