"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showCommand = showCommand;
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const moment_1 = __importDefault(require("moment"));
const database_1 = require("../database");
async function showCommand(id, workDir) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    const history = await db.getImportHistory(100);
    let foundRaw = null;
    for (const session of history) {
        const records = await db.getRawRecordsByBatch(session.batchId);
        foundRaw = records.find(r => r.id === id);
        if (foundRaw)
            break;
    }
    if (!foundRaw) {
        console.log(chalk_1.default.red(`记录 ${id} 不存在`));
        return;
    }
    console.log(chalk_1.default.blue(`记录详情: ${id}`));
    console.log('');
    const infoTable = new cli_table3_1.default({
        colWidths: [20, 60],
    });
    infoTable.push(['记录ID', foundRaw.id], ['源文件', foundRaw.sourceFile], ['数据类型', foundRaw.sourceType], ['原始行号', foundRaw.rawLineNumber.toString()], ['状态', getStatusColor(foundRaw.status)(foundRaw.status)], ['导入时间', (0, moment_1.default)(foundRaw.importedAt).format('YYYY-MM-DD HH:mm:ss')], ['批次号', foundRaw.importBatchId]);
    console.log(chalk_1.default.yellow('原始记录信息:'));
    console.log(infoTable.toString());
    console.log('');
    console.log(chalk_1.default.yellow('原始内容:'));
    const rawContent = JSON.parse(foundRaw.rawContent);
    const rawTable = new cli_table3_1.default({
        head: ['字段', '值'],
        colWidths: [25, 55],
    });
    for (const [key, value] of Object.entries(rawContent)) {
        rawTable.push([key, String(value)]);
    }
    console.log(rawTable.toString());
    console.log('');
    const allStdRecords = [];
    const stdRecordsAll = await db.getStandardizedRecordsByFact('');
    for (const s of stdRecordsAll) {
        if (s.rawRecordId === foundRaw.id) {
            allStdRecords.push(s);
        }
    }
    if (allStdRecords.length > 0) {
        console.log(chalk_1.default.yellow('标准化数据:'));
        const stdTable = new cli_table3_1.default({
            head: ['字段', '值'],
            colWidths: [25, 55],
        });
        const std = allStdRecords[0];
        const stdFields = [
            ['工单号', std.orderNumber],
            ['住户姓名', std.residentName],
            ['房间号', std.roomNumber],
            ['联系电话', std.phoneNumber],
            ['维修类型', std.repairType],
            ['问题描述', std.description],
            ['报修时间', std.reportTime ? (0, moment_1.default)(std.reportTime).format('YYYY-MM-DD HH:mm') : ''],
            ['维修师傅', std.technicianName],
            ['到达时间', std.arrivalTime ? (0, moment_1.default)(std.arrivalTime).format('YYYY-MM-DD HH:mm') : ''],
            ['完成时间', std.completionTime ? (0, moment_1.default)(std.completionTime).format('YYYY-MM-DD HH:mm') : ''],
            ['维修结果', std.repairResult],
            ['材料名称', std.materialName],
            ['材料数量', std.materialQuantity],
            ['单位', std.materialUnit],
            ['主管批注', std.supervisorNote],
            ['置信度', std.confidence.toFixed(2)],
            ['人工改判', std.isManualOverride ? '是' : '否'],
            ['标准化时间', (0, moment_1.default)(std.standardizedAt).format('YYYY-MM-DD HH:mm:ss')],
            ['标准化人', std.standardizedBy],
        ];
        for (const [field, value] of stdFields) {
            if (value !== undefined && value !== '' && value !== null) {
                stdTable.push([field, String(value)]);
            }
        }
        console.log(stdTable.toString());
        const fact = await db.findFactByOrderNumber(std.orderNumber);
        if (fact) {
            console.log('');
            console.log(chalk_1.default.yellow('关联工单事实:'));
            const factTable = new cli_table3_1.default({
                colWidths: [20, 60],
            });
            factTable.push(['工单ID', fact.id], ['工单号', fact.orderNumber], ['当前状态', fact.currentStatus], ['版本号', fact.version.toString()], ['是否冻结', fact.isFrozen ? chalk_1.default.blue('是') : '否'], ['创建时间', (0, moment_1.default)(fact.createdAt).format('YYYY-MM-DD HH:mm:ss')], ['更新时间', (0, moment_1.default)(fact.updatedAt).format('YYYY-MM-DD HH:mm:ss')]);
            console.log(factTable.toString());
        }
    }
    const errors = await db.getUnresolvedErrors(foundRaw.id);
    if (errors.length > 0) {
        console.log('');
        console.log(chalk_1.default.red('关联错误:'));
        const errTable = new cli_table3_1.default({
            head: ['错误ID', '字段', '错误码', '错误信息', '严重程度'],
            colWidths: [14, 12, 16, 32, 10],
        });
        for (const error of errors) {
            errTable.push([
                error.id,
                error.fieldName,
                error.errorCode,
                error.errorMessage,
                error.severity === 'error' ? chalk_1.default.red('错误') : chalk_1.default.yellow('警告'),
            ]);
        }
        console.log(errTable.toString());
    }
}
function getStatusColor(status) {
    switch (status) {
        case 'imported':
            return chalk_1.default.green;
        case 'failed':
            return chalk_1.default.red;
        case 'fixed':
            return chalk_1.default.blue;
        case 'withdrawn':
            return chalk_1.default.gray;
        case 'pending':
            return chalk_1.default.yellow;
        default:
            return chalk_1.default.white;
    }
}
//# sourceMappingURL=show.js.map