"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exporter = exports.Exporter = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const fs_1 = __importDefault(require("fs"));
class Exporter {
    async exportToExcel(records, outputPath) {
        const workbook = new exceljs_1.default.Workbook();
        const worksheet = workbook.addWorksheet('质检结果');
        worksheet.columns = [
            { header: '通话ID', key: 'callId', width: 20 },
            { header: '坐席姓名', key: 'agentName', width: 15 },
            { header: '坐席工号', key: 'agentId', width: 15 },
            { header: '通话日期', key: 'callDate', width: 15 },
            { header: '通话时长(秒)', key: 'callDuration', width: 15 },
            { header: '检测状态', key: 'status', width: 12 },
            { header: '异常类型', key: 'anomalyTypes', width: 30 },
            { header: '异常描述', key: 'anomalyDescriptions', width: 50 },
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        records.forEach(record => {
            const anomalyTypes = [...new Set(record.anomalies.map(a => this.translateAnomalyType(a.anomalyType)))];
            const anomalyDescriptions = record.anomalies.map(a => a.description).join('; ');
            const row = worksheet.addRow({
                callId: record.callId,
                agentName: record.agentName,
                agentId: record.agentId,
                callDate: record.callDate,
                callDuration: record.callDuration,
                status: this.translateStatus(record.status),
                anomalyTypes: anomalyTypes.join(', ') || '无',
                anomalyDescriptions: anomalyDescriptions || '正常'
            });
            if (record.status === 'abnormal') {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFE0E0' }
                };
            }
        });
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: 8 }
        };
        await workbook.xlsx.writeFile(outputPath);
        return outputPath;
    }
    async exportToCSV(records, outputPath) {
        const headers = [
            '通话ID', '坐席姓名', '坐席工号', '通话日期', '通话时长(秒)',
            '检测状态', '异常类型', '异常描述'
        ];
        const rows = records.map(record => {
            const anomalyTypes = [...new Set(record.anomalies.map(a => this.translateAnomalyType(a.anomalyType)))];
            const anomalyDescriptions = record.anomalies.map(a => a.description).join('; ');
            return [
                record.callId,
                record.agentName,
                record.agentId,
                record.callDate,
                record.callDuration.toString(),
                this.translateStatus(record.status),
                anomalyTypes.join(', ') || '无',
                anomalyDescriptions || '正常'
            ].map(field => `"${field.replace(/"/g, '""')}"`).join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        fs_1.default.writeFileSync(outputPath, '\uFEFF' + csvContent, 'utf-8');
        return outputPath;
    }
    translateStatus(status) {
        const statusMap = {
            'normal': '正常',
            'abnormal': '异常',
            'pending': '待检测'
        };
        return statusMap[status] || status;
    }
    translateAnomalyType(type) {
        const typeMap = {
            'apology_missing': '缺少道歉',
            'refund_promise_missing': '缺少退款承诺',
            'sensitive_word': '敏感词',
            'other': '其他'
        };
        return typeMap[type] || type;
    }
}
exports.Exporter = Exporter;
exports.exporter = new Exporter();
