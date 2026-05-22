"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCommand = exportCommand;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const XLSX = __importStar(require("xlsx"));
const moment_1 = __importDefault(require("moment"));
const database_1 = require("../database");
async function exportCommand(workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    const db = (0, database_1.getDatabase)(absoluteDir);
    const format = options.format || 'xlsx';
    const exportDir = path_1.default.join(absoluteDir, 'exports');
    const timestamp = (0, moment_1.default)().format('YYYYMMDD_HHmmss');
    const filename = `pmi_export_${timestamp}.${format}`;
    const outputPath = options.output || path_1.default.join(exportDir, filename);
    console.log(chalk_1.default.blue('导出数据'));
    console.log(chalk_1.default.gray(`  格式: ${format}`));
    console.log(chalk_1.default.gray(`  输出: ${outputPath}`));
    console.log('');
    const facts = await db.getFactRecords();
    const exportFacts = options.frozenOnly ? facts.filter(f => f.isFrozen) : facts;
    if (exportFacts.length === 0) {
        console.log(chalk_1.default.yellow('没有可导出的数据'));
        return;
    }
    const exportData = [];
    for (const fact of exportFacts) {
        const stdRecords = await db.getStandardizedRecordsByFact(fact.id);
        const baseData = {
            工单号: fact.orderNumber,
            当前状态: fact.currentStatus,
            版本: fact.version,
            是否冻结: fact.isFrozen ? '是' : '否',
            冻结时间: fact.frozenAt ? (0, moment_1.default)(fact.frozenAt).format('YYYY-MM-DD HH:mm') : '',
            创建时间: (0, moment_1.default)(fact.createdAt).format('YYYY-MM-DD HH:mm'),
            更新时间: (0, moment_1.default)(fact.updatedAt).format('YYYY-MM-DD HH:mm'),
        };
        const mergedData = { ...baseData };
        for (const std of stdRecords) {
            if (std.residentName)
                mergedData['住户姓名'] = std.residentName;
            if (std.roomNumber)
                mergedData['房间号'] = std.roomNumber;
            if (std.phoneNumber)
                mergedData['联系电话'] = std.phoneNumber;
            if (std.repairType)
                mergedData['维修类型'] = std.repairType;
            if (std.description)
                mergedData['问题描述'] = std.description;
            if (std.reportTime)
                mergedData['报修时间'] = (0, moment_1.default)(std.reportTime).format('YYYY-MM-DD HH:mm');
            if (std.technicianName)
                mergedData['维修师傅'] = std.technicianName;
            if (std.arrivalTime)
                mergedData['到达时间'] = (0, moment_1.default)(std.arrivalTime).format('YYYY-MM-DD HH:mm');
            if (std.completionTime)
                mergedData['完成时间'] = (0, moment_1.default)(std.completionTime).format('YYYY-MM-DD HH:mm');
            if (std.repairResult)
                mergedData['维修结果'] = std.repairResult;
            if (std.materialName)
                mergedData['材料名称'] = std.materialName;
            if (std.materialQuantity !== undefined)
                mergedData['材料数量'] = std.materialQuantity;
            if (std.materialUnit)
                mergedData['单位'] = std.materialUnit;
            if (std.supervisorNote)
                mergedData['主管批注'] = std.supervisorNote;
            if (std.isManualOverride)
                mergedData['人工改判'] = '是';
        }
        if (options.includeRaw) {
            const rawRecords = stdRecords.map(s => {
                return `${s.rawRecordId}`;
            }).filter(Boolean);
            mergedData['来源记录ID'] = rawRecords.join('; ');
        }
        exportData.push(mergedData);
    }
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    switch (format) {
        case 'json':
            fs_1.default.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
            break;
        case 'csv':
            const csvContent = convertToCsv(exportData);
            fs_1.default.writeFileSync(outputPath, csvContent, 'utf8');
            break;
        case 'xlsx':
        default:
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '工单数据');
            if (options.includeRaw) {
                const errors = await db.getUnresolvedErrors();
                const errorData = errors.map(e => ({
                    错误ID: e.id,
                    记录ID: e.recordId,
                    字段: e.fieldName,
                    错误码: e.errorCode,
                    错误信息: e.errorMessage,
                    严重程度: e.severity,
                    创建时间: (0, moment_1.default)(e.createdAt).format('YYYY-MM-DD HH:mm'),
                }));
                const wsErrors = XLSX.utils.json_to_sheet(errorData);
                XLSX.utils.book_append_sheet(wb, wsErrors, '错误清单');
            }
            XLSX.writeFile(wb, outputPath);
            break;
    }
    console.log(chalk_1.default.green(`✓ 导出成功!`));
    console.log(chalk_1.default.gray(`  导出记录数: ${exportData.length}`));
    console.log(chalk_1.default.gray(`  文件路径: ${outputPath}`));
}
function convertToCsv(data) {
    if (data.length === 0)
        return '';
    const headers = Object.keys(data[0]);
    const headerLine = headers.join(',');
    const lines = data.map(row => {
        return headers.map(h => {
            let value = row[h] || '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        }).join(',');
    });
    return [headerLine, ...lines].join('\n');
}
//# sourceMappingURL=export.js.map