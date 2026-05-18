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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWriter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_writer_1 = require("csv-writer");
class FileWriter {
    static async writeReconciliationResult(result, outputPath) {
        const absolutePath = path.resolve(outputPath);
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: absolutePath,
            header: [
                { id: 'returnOrderNo', title: '返厂单号' },
                { id: 'partCode', title: '备件编码' },
                { id: 'partName', title: '备件名称' },
                { id: 'returnDate', title: '返厂日期' },
                { id: 'returnStatus', title: '返厂状态' },
                { id: 'inventoryStatus', title: '库存状态' },
                { id: 'inspectionResult', title: '检测结果' },
                { id: 'repairStatus', title: '维修状态' },
                { id: 'reconciliationStatus', title: '对账状态' },
                { id: 'remarks', title: '备注' },
                { id: 'isAbnormal', title: '是否异常' },
            ],
        });
        const records = result.records.map((record) => ({
            ...record,
            isAbnormal: record.isAbnormal ? '是' : '否',
        }));
        await csvWriter.writeRecords(records);
        const summaryPath = absolutePath.replace('.csv', '_摘要.txt');
        await this.writeSummary(result, summaryPath);
    }
    static async writeSummary(result, summaryPath) {
        const summary = result.summary;
        const lines = [
            '========================================',
            '    备件返厂记录维修件状态对账报告摘要',
            '========================================',
            '',
            `对账日期: ${new Date().toLocaleString('zh-CN')}`,
            '',
            '----------------------------------------',
            '总体统计',
            '----------------------------------------',
            `总记录数: ${summary.totalRecords}`,
            `正常记录: ${summary.normalCount} (${((summary.normalCount / summary.totalRecords) * 100).toFixed(1)}%)`,
            `异常记录: ${summary.abnormalCount} (${((summary.abnormalCount / summary.totalRecords) * 100).toFixed(1)}%)`,
            '',
            '----------------------------------------',
            '异常分类明细',
            '----------------------------------------',
            `拆件维修: ${summary.breakdown.dismantleRepair} 条`,
            `检测驳回: ${summary.breakdown.inspectionRejected} 条`,
            `承运商丢件: ${summary.breakdown.carrierLost} 条`,
            `状态不一致: ${summary.breakdown.statusMismatch} 条`,
            `库存缺失: ${summary.breakdown.inventoryMissing} 条`,
            `检测缺失: ${summary.breakdown.inspectionMissing} 条`,
            '',
            '----------------------------------------',
            '异常记录清单',
            '----------------------------------------',
        ];
        const abnormalRecords = result.records.filter((r) => r.isAbnormal);
        if (abnormalRecords.length > 0) {
            for (const record of abnormalRecords) {
                lines.push(`[${record.reconciliationStatus}] ${record.returnOrderNo} - ${record.partName} (${record.partCode}): ${record.remarks}`);
            }
        }
        else {
            lines.push('无异常记录');
        }
        lines.push('');
        lines.push('========================================');
        lines.push('            报告生成完毕');
        lines.push('========================================');
        fs.writeFileSync(summaryPath, lines.join('\n'), { encoding: 'utf-8' });
    }
}
exports.FileWriter = FileWriter;
