"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataExporter = void 0;
const path_1 = __importDefault(require("path"));
const csv_writer_1 = require("csv-writer");
const xlsx_1 = __importDefault(require("xlsx"));
class DataExporter {
    constructor(db) {
        this.db = db;
    }
    async exportGradingSheet(filter, config, outputDir) {
        const records = this.db.filterRecords(filter);
        const outputPath = outputDir || process.cwd();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = config.filename || `实验批改表_${timestamp}`;
        const rows = records.map(record => this.formatRecordForExport(record, config));
        const summary = this.generateSummary(records);
        let filePath;
        if (config.format === 'csv') {
            filePath = await this.exportCSV(rows, outputPath, filename);
        }
        else {
            filePath = this.exportExcel(rows, outputPath, filename, config, summary);
        }
        return {
            success: true,
            filePath,
            recordCount: records.length,
            summary
        };
    }
    formatRecordForExport(record, config) {
        const base = {
            '序号': '',
            '学号': record.student.studentId,
            '姓名': record.student.studentName,
            '组别': record.student.groupId || '',
            '实验日期': record.student.experimentDate,
            '状态': this.getStatusText(record.status),
            '异常数': record.anomalies.length
        };
        if (config.includeCalculations) {
            Object.assign(base, {
                '钢球质量(kg)': record.rawData.ballMass,
                '初始高度(cm)': record.rawData.initialHeight,
                '水平位移(cm)': record.rawData.horizontalDisplacement,
                '碰撞位移(cm)': record.rawData.collisionDisplacement,
                '初始动量(kg·m/s)': record.calculation.initialMomentum.toFixed(4),
                '碰撞动量(kg·m/s)': record.calculation.collisionMomentum.toFixed(4),
                '动量损失率(%)': record.calculation.momentumLossRate.toFixed(2),
                '能量损失率(%)': record.calculation.energyLossRate.toFixed(2)
            });
        }
        if (config.includeAnomalies && record.anomalies.length > 0) {
            Object.assign(base, {
                '异常类型': record.anomalies.map(a => this.getAnomalyTypeText(a.type)).join('; '),
                '异常说明': record.anomalies.map(a => a.message).join('; '),
                '处理建议': record.anomalies.map(a => a.suggestion).join('; ')
            });
        }
        else {
            Object.assign(base, {
                '异常类型': '',
                '异常说明': '',
                '处理建议': ''
            });
        }
        if (config.includeGrading) {
            Object.assign(base, {
                '得分': record.grading?.score || '',
                '批改意见': record.grading?.comments || '',
                '批改人': record.grading?.gradedBy || '',
                '批改时间': record.grading?.gradedAt || ''
            });
        }
        return base;
    }
    async exportCSV(rows, outputPath, filename) {
        const fullPath = path_1.default.join(outputPath, `${filename}.csv`);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: fullPath,
            header: Object.keys(rows[0] || {}).map(key => ({ id: key, title: key }))
        });
        rows.forEach((row, index) => {
            row['序号'] = index + 1;
        });
        await csvWriter.writeRecords(rows);
        return fullPath;
    }
    exportExcel(rows, outputPath, filename, config, summary) {
        const fullPath = path_1.default.join(outputPath, `${filename}.xlsx`);
        rows.forEach((row, index) => {
            row['序号'] = index + 1;
        });
        const wb = xlsx_1.default.utils.book_new();
        const ws1 = xlsx_1.default.utils.json_to_sheet(rows);
        xlsx_1.default.utils.book_append_sheet(wb, ws1, '实验批改表');
        if (config.includeHistory) {
            const historyRows = this.db.getAllHistory().slice(0, 1000).map((h, i) => ({
                '序号': i + 1,
                '记录ID': h.recordId,
                '操作类型': this.getActionText(h.action),
                '操作人': h.operator,
                '操作时间': h.timestamp,
                '变更内容': h.changes.map(c => `${c.field}: ${c.oldValue || '空'} → ${c.newValue || '空'}`).join('; '),
                '原因': h.reason || ''
            }));
            const ws2 = xlsx_1.default.utils.json_to_sheet(historyRows);
            xlsx_1.default.utils.book_append_sheet(wb, ws2, '操作历史');
        }
        const summaryRows = [
            { '项目': '总记录数', '数值': summary.totalRecords },
            { '项目': '已批改数', '数值': summary.gradedRecords },
            { '项目': '待处理数', '数值': summary.pendingRecords },
            { '项目': '有异常记录数', '数值': summary.recordsWithAnomalies },
            { '项目': '平均分', '数值': summary.averageScore.toFixed(2) },
            { '项目': '导出时间', '数值': new Date().toLocaleString('zh-CN') }
        ];
        const ws3 = xlsx_1.default.utils.json_to_sheet(summaryRows);
        xlsx_1.default.utils.book_append_sheet(wb, ws3, '统计摘要');
        xlsx_1.default.writeFile(wb, fullPath);
        return fullPath;
    }
    generateSummary(records) {
        const graded = records.filter(r => r.status === 'graded');
        const totalScore = graded.reduce((sum, r) => sum + (r.grading?.score || 0), 0);
        return {
            totalRecords: records.length,
            gradedRecords: graded.length,
            pendingRecords: records.filter(r => r.status === 'pending').length,
            recordsWithAnomalies: records.filter(r => r.anomalies.length > 0).length,
            averageScore: graded.length > 0 ? totalScore / graded.length : 0
        };
    }
    getStatusText(status) {
        const map = {
            'pending': '待处理',
            'imported': '已导入',
            'reviewed': '已审核',
            'graded': '已批改',
            'withdrawn': '已撤回'
        };
        return map[status] || status;
    }
    getAnomalyTypeText(type) {
        const map = {
            'momentum_loss': '动量损失',
            'energy_loss': '能量损失',
            'unit_error': '单位错误',
            'outlier': '数值异常',
            'missing_data': '数据缺失'
        };
        return map[type] || type;
    }
    getActionText(action) {
        const map = {
            'import': '导入',
            'update': '更新',
            'grade': '批改',
            'withdraw': '撤回',
            'restore': '恢复',
            'anomaly_fixed': '异常修复'
        };
        return map[action] || action;
    }
}
exports.DataExporter = DataExporter;
