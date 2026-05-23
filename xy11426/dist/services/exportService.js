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
exports.exportToCSV = exportToCSV;
exports.exportToExcel = exportToExcel;
exports.exportReportToText = exportReportToText;
exports.exportFailuresToCSV = exportFailuresToCSV;
exports.exportAuditLogs = exportAuditLogs;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
const database_1 = require("../db/database");
function exportToCSV(batchId, outputPath) {
    const db = (0, database_1.getDatabase)();
    const records = db.prepare(`
    SELECT 
      original_line_no as 原始行号,
      visitor_name as 访客姓名,
      visitor_phone as 手机号,
      id_card as 身份证号,
      plate_number as 车牌号,
      visit_date as 访问日期,
      start_time as 开始时间,
      end_time as 结束时间,
      gate_passed as 是否通行,
      pass_time as 通行时间,
      gate_no as 闸机号,
      status as 状态,
      check_result as 校验结果
    FROM visitor_records 
    WHERE batch_id = ? 
    ORDER BY original_line_no
  `).all(batchId);
    if (records.length === 0) {
        throw new Error('没有可导出的数据');
    }
    const headers = Object.keys(records[0]);
    let csvContent = headers.join(',') + '\n';
    for (const record of records) {
        const row = headers.map(h => {
            const value = record[h];
            const strValue = String(value || '');
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return '"' + strValue.replace(/"/g, '""') + '"';
            }
            return strValue;
        });
        csvContent += row.join(',') + '\n';
    }
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    fs_1.default.writeFileSync(outputPath, csvContent, 'utf-8');
}
function exportToExcel(batchId, outputPath) {
    const db = (0, database_1.getDatabase)();
    const records = db.prepare(`
    SELECT 
      original_line_no as 原始行号,
      visitor_name as 访客姓名,
      visitor_phone as 手机号,
      id_card as 身份证号,
      plate_number as 车牌号,
      visit_date as 访问日期,
      start_time as 开始时间,
      end_time as 结束时间,
      CASE WHEN gate_passed = 1 THEN '是' ELSE '否' END as 是否通行,
      pass_time as 通行时间,
      gate_no as 闸机号,
      CASE status 
        WHEN 'raw' THEN '原始'
        WHEN 'valid' THEN '有效'
        WHEN 'invalid' THEN '无效'
        WHEN 'fixed' THEN '已修复'
        ELSE status 
      END as 状态,
      check_result as 校验结果
    FROM visitor_records 
    WHERE batch_id = ? 
    ORDER BY original_line_no
  `).all(batchId);
    if (records.length === 0) {
        throw new Error('没有可导出的数据');
    }
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '访客记录');
    XLSX.writeFile(wb, outputPath);
}
function exportReportToText(report, outputPath) {
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const sourceTypeNames = {
        'visitor_appointment': '访客预约表',
        'gate_record': '闸机记录',
        'temp_plate': '临时车牌',
        'refund_flow': '退款流水'
    };
    let text = `
=================================================================
                    园区访客通行巡检报表
=================================================================

【基本信息】
  批次ID: ${report.batchId}
  文件名: ${report.fileName}
  数据类型: ${sourceTypeNames[report.sourceType] || report.sourceType}
  导入时间: ${report.importTime}
  操作员: ${report.operator}

【数据统计】
  总记录数: ${report.totalRecords}
  有效记录: ${report.validRecords}
  问题记录: ${report.invalidRecords}
  已修复: ${report.fixedRecords}

=================================================================
                        失败清单
=================================================================

`;
    if (report.failures.length === 0) {
        text += '  无失败记录\n';
    }
    else {
        text += `  行号  | 访客姓名 | 问题原因\n`;
        text += `  ${'-'.repeat(60)}\n`;
        for (const failure of report.failures) {
            text += `  ${String(failure.originalLineNo).padEnd(4)} | ${failure.visitorName.padEnd(8)} | ${failure.reason}\n`;
            text += `         |          | 建议: ${failure.suggestion}\n`;
        }
    }
    text += `
=================================================================
                        修复清单
=================================================================

`;
    if (report.fixedList.length === 0) {
        text += '  无修复记录\n';
    }
    else {
        text += `  行号  | 访客姓名 | 修复内容\n`;
        text += `  ${'-'.repeat(60)}\n`;
        for (const fixed of report.fixedList) {
            text += `  ${String(fixed.originalLineNo).padEnd(4)} | ${fixed.visitorName.padEnd(8)} | ${fixed.fixReason}\n`;
            text += `         |          | ${fixed.oldValue} → ${fixed.newValue}\n`;
        }
    }
    text += `
=================================================================
                          报表结束
=================================================================
`;
    fs_1.default.writeFileSync(outputPath, text, 'utf-8');
}
function exportFailuresToCSV(batchId, outputPath) {
    const db = (0, database_1.getDatabase)();
    const records = db.prepare(`
    SELECT 
      vr.original_line_no as 原始行号,
      vr.visitor_name as 访客姓名,
      vr.visitor_phone as 手机号,
      vr.plate_number as 车牌号,
      vr.visit_date as 访问日期,
      cr.message as 失败原因,
      '请检查数据后修正' as 处理建议
    FROM visitor_records vr
    JOIN check_results cr ON vr.id = cr.record_id
    WHERE vr.batch_id = ? AND vr.status = 'invalid' AND cr.passed = 0
    GROUP BY vr.id
    ORDER BY vr.original_line_no
  `).all(batchId);
    if (records.length === 0) {
        throw new Error('没有失败记录可导出');
    }
    const headers = Object.keys(records[0]);
    let csvContent = headers.join(',') + '\n';
    for (const record of records) {
        const row = headers.map(h => {
            const value = record[h];
            const strValue = String(value || '');
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return '"' + strValue.replace(/"/g, '""') + '"';
            }
            return strValue;
        });
        csvContent += row.join(',') + '\n';
    }
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    fs_1.default.writeFileSync(outputPath, csvContent, 'utf-8');
}
function exportAuditLogs(batchId, outputPath) {
    const db = (0, database_1.getDatabase)();
    const logs = db.prepare(`
    SELECT 
      created_at as 操作时间,
      operator as 操作员,
      action as 操作类型,
      old_value as 旧值,
      new_value as 新值
    FROM audit_logs 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `).all(batchId);
    if (logs.length === 0) {
        throw new Error('没有审计日志可导出');
    }
    const headers = Object.keys(logs[0]);
    let csvContent = headers.join(',') + '\n';
    for (const log of logs) {
        const row = headers.map(h => {
            const value = log[h];
            const strValue = String(value || '');
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return '"' + strValue.replace(/"/g, '""') + '"';
            }
            return strValue;
        });
        csvContent += row.join(',') + '\n';
    }
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    fs_1.default.writeFileSync(outputPath, csvContent, 'utf-8');
}
